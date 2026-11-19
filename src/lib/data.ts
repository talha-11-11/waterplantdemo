import "server-only";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Customer, Settings } from "@/db/schema";
import { monthStart, nextMonthStart } from "./dates";

const { settings, customers, deliveries, payments } = schema;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(settings).where(eq(settings.id, 1)))[0];
}

export function pricesFor(c: Pick<Customer, "priceStd" | "priceDisp">, s: Settings) {
  return { std: c.priceStd ?? s.priceStd, disp: c.priceDisp ?? s.priceDisp };
}

const num = (v: unknown) => Number(v ?? 0);

/** Balance (positive = customer owes) for every customer, optionally as of before a date. */
export async function balances(before?: string): Promise<Map<number, number>> {
  const dCond = before ? sql`and d.date < ${before}` : sql``;
  const pCond = before ? sql`and p.date < ${before}` : sql``;
  const res = await db.execute(sql`
    select c.id,
      c.opening_balance
      + coalesce((select sum(d.amount) from deliveries d where d.customer_id = c.id ${dCond}), 0)
      - coalesce((select sum(p.amount) from payments p where p.customer_id = c.id ${pCond}), 0) as balance
    from customers c`);
  return new Map(res.rows.map((r) => [num(r.id), num(r.balance)]));
}

export async function customerBalance(id: number, before?: string): Promise<number> {
  const dCond = before ? sql`and d.date < ${before}` : sql``;
  const pCond = before ? sql`and p.date < ${before}` : sql``;
  const res = await db.execute(sql`
    select c.opening_balance
      + coalesce((select sum(d.amount) from deliveries d where d.customer_id = c.id ${dCond}), 0)
      - coalesce((select sum(p.amount) from payments p where p.customer_id = c.id ${pCond}), 0) as balance
    from customers c where c.id = ${id}`);
  return num(res.rows[0]?.balance);
}

/** Delivery totals per customer for an inclusive date range. */
export async function deliveryTotals(from: string, to: string) {
  const rows = await db
    .select({
      customerId: deliveries.customerId,
      std: sql<string>`sum(${deliveries.std})`,
      disp: sql<string>`sum(${deliveries.disp})`,
      amount: sql<string>`sum(${deliveries.amount})`,
      days: sql<string>`count(*)`,
    })
    .from(deliveries)
    .where(and(gte(deliveries.date, from), lte(deliveries.date, to)))
    .groupBy(deliveries.customerId);
  return new Map(rows.map((r) => [r.customerId, {
    std: num(r.std), disp: num(r.disp), amount: num(r.amount), days: num(r.days),
  }]));
}

export async function paymentTotals(from: string, toExclusive: string) {
  const rows = await db
    .select({ customerId: payments.customerId, amount: sql<string>`sum(${payments.amount})` })
    .from(payments)
    .where(and(gte(payments.date, from), lt(payments.date, toExclusive)))
    .groupBy(payments.customerId);
  return new Map(rows.map((r) => [r.customerId, num(r.amount)]));
}

export async function monthStats(m: string) {
  const start = monthStart(m);
  const end = nextMonthStart(m);
  const [d] = await db
    .select({
      std: sql<string>`coalesce(sum(${deliveries.std}),0)`,
      disp: sql<string>`coalesce(sum(${deliveries.disp}),0)`,
      amount: sql<string>`coalesce(sum(${deliveries.amount}),0)`,
    })
    .from(deliveries)
    .where(and(gte(deliveries.date, start), lt(deliveries.date, end)));
  const [p] = await db
    .select({ amount: sql<string>`coalesce(sum(${payments.amount}),0)` })
    .from(payments)
    .where(and(gte(payments.date, start), lt(payments.date, end)));
  const bySociety = await db
    .select({
      society: customers.society,
      std: sql<string>`sum(${deliveries.std})`,
      disp: sql<string>`sum(${deliveries.disp})`,
      amount: sql<string>`sum(${deliveries.amount})`,
    })
    .from(deliveries)
    .innerJoin(customers, eq(customers.id, deliveries.customerId))
    .where(and(gte(deliveries.date, start), lt(deliveries.date, end)))
    .groupBy(customers.society)
    .orderBy(sql`sum(${deliveries.amount}) desc`);
  return {
    std: num(d.std), disp: num(d.disp), amount: num(d.amount), collected: num(p.amount),
    bySociety: bySociety.map((r) => ({ society: r.society, std: num(r.std), disp: num(r.disp), amount: num(r.amount) })),
  };
}

export async function societies(): Promise<string[]> {
  const rows = await db.selectDistinct({ s: customers.society }).from(customers).orderBy(customers.society);
  const list = rows.map((r) => r.s).filter(Boolean);
  return list.length ? list : ["Citi Housing", "Green Valley", "Chenab Gardens"];
}
