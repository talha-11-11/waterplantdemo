import "server-only";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { balances, deliveryTotals, paymentTotals } from "./data";
import { addDays, monthStart, nextMonthStart } from "./dates";

const { bills, customers, deliveries } = schema;

/**
 * Create or refresh bills for a month, always recalculated from deliveries and payments,
 * so a payment entered after the bill was made is reflected straight away.
 * total due = balance before the month + this month's cans − payments made this month.
 * A new bill is made for every customer who got cans that month or still owes money;
 * an existing bill is always updated (even if it is now fully paid).
 */
export async function generateBills(month: string, onlyCustomerId?: number) {
  const start = monthStart(month);
  const end = nextMonthStart(month);
  const [prev, totals, paid, all, existing] = await Promise.all([
    balances(start),
    deliveryTotals(start, addDays(end, -1)),
    paymentTotals(start, end),
    onlyCustomerId
      ? db.select().from(customers).where(eq(customers.id, onlyCustomerId))
      : db.select().from(customers),
    db.select({ customerId: bills.customerId }).from(bills).where(eq(bills.month, month)),
  ]);
  const hasBill = new Set(existing.map((e) => e.customerId));

  let count = 0;
  for (const c of all) {
    const t = totals.get(c.id) ?? { std: 0, disp: 0, amount: 0 };
    const previousBalance = prev.get(c.id) ?? c.openingBalance;
    const paymentsInMonth = paid.get(c.id) ?? 0;
    const totalDue = previousBalance + t.amount - paymentsInMonth;
    if (t.amount === 0 && totalDue <= 0 && !hasBill.has(c.id)) continue;

    const values = {
      customerId: c.id, month, std: t.std, disp: t.disp, charges: t.amount,
      previousBalance, paymentsInMonth, totalDue,
    };
    await db.insert(bills).values(values).onConflictDoUpdate({
      target: [bills.customerId, bills.month],
      set: {
        std: values.std, disp: values.disp, charges: values.charges,
        previousBalance, paymentsInMonth, totalDue,
      },
    });
    count++;
  }
  return count;
}

export async function getBillWithDetails(billId: number) {
  const [ref] = await db.select({ customerId: bills.customerId, month: bills.month }).from(bills).where(eq(bills.id, billId));
  if (!ref) return null;
  await generateBills(ref.month, ref.customerId); // always show up-to-date numbers
  const [row] = await db
    .select({ bill: bills, customer: customers })
    .from(bills)
    .innerJoin(customers, eq(customers.id, bills.customerId))
    .where(eq(bills.id, billId));
  if (!row) return null;
  const start = monthStart(row.bill.month);
  const end = nextMonthStart(row.bill.month);
  const items = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.customerId, row.customer.id), gte(deliveries.date, start), lt(deliveries.date, end)))
    .orderBy(asc(deliveries.date));
  return { ...row, items };
}

export async function billsForMonth(month: string) {
  return db
    .select({ bill: bills, customer: customers })
    .from(bills)
    .innerJoin(customers, eq(customers.id, bills.customerId))
    .where(eq(bills.month, month))
    .orderBy(asc(customers.society), asc(customers.name));
}

export async function unsentBillCount(month: string) {
  const [r] = await db
    .select({ n: sql<string>`count(*)` })
    .from(bills)
    .where(and(eq(bills.month, month), sql`${bills.sentAt} is null`));
  return Number(r?.n ?? 0);
}
