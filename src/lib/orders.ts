import "server-only";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Customer } from "@/db/schema";
import { addDays, pkToday } from "./dates";
import { normalizePhone } from "./format";
import { parseOrderText } from "./orderParse";

const { orders, customers, deliveries } = schema;

/** Find the customer a message is from: by phone first, then by name written in the text. */
export async function matchCustomer(text: string, fromPhone?: string | null): Promise<Customer | null> {
  const all = await db.select().from(customers).where(eq(customers.active, true));
  const phones = [fromPhone, parseOrderText(text, pkToday()).phone].map((p) => (p ? normalizePhone(p) : null)).filter(Boolean);
  for (const p of phones) {
    const c = all.find((x) => x.phone === p);
    if (c) return c;
  }
  const t = text.toLowerCase();
  const byName = all.filter((c) => c.name && t.includes(c.name.toLowerCase()));
  return byName.length === 1 ? byName[0] : null;
}

/** Turn a WhatsApp message into an open order. Uses the customer's usual cans if no number is written. */
export async function orderFromMessage(opts: {
  text: string; fromPhone?: string | null; fromName?: string; source: "paste" | "whatsapp"; by: string; customerId?: number | null;
}) {
  const today = pkToday();
  const parsed = parseOrderText(opts.text, today);
  let customer: Customer | null = null;
  if (opts.customerId) {
    [customer] = await db.select().from(customers).where(eq(customers.id, opts.customerId));
  } else {
    customer = await matchCustomer(opts.text, opts.fromPhone);
  }
  const std = parsed.foundQty ? parsed.std : customer?.defaultStd ?? 1;
  const disp = parsed.foundQty ? parsed.disp : customer?.defaultDisp ?? 0;
  const [row] = await db.insert(orders).values({
    customerId: customer?.id ?? null,
    fromName: customer ? "" : opts.fromName || "",
    fromPhone: customer ? "" : (opts.fromPhone ? normalizePhone(opts.fromPhone) ?? opts.fromPhone : parsed.phone ?? ""),
    date: parsed.date, std, disp, source: opts.source, rawText: opts.text.slice(0, 1000), createdBy: opts.by,
  }).returning();
  return { order: row, customer, parsed };
}

export async function openOrdersFor(date: string) {
  return db.select().from(orders).where(and(eq(orders.status, "open"), lte(orders.date, date)));
}

export async function listOrders(status: "open" | "done") {
  const where = status === "open" ? eq(orders.status, "open") : ne(orders.status, "open");
  return db.select({ o: orders, c: customers }).from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(where)
    .orderBy(status === "open" ? asc(orders.date) : desc(orders.doneAt), desc(orders.id))
    .limit(100);
}

/** Delivering to a customer closes their open orders up to that date. */
export async function closeOrdersOnDelivery(customerId: number, date: string) {
  await db.update(orders).set({ status: "delivered", doneAt: new Date() })
    .where(and(eq(orders.customerId, customerId), eq(orders.status, "open"), lte(orders.date, date)));
}

/** Undoing a delivery re-opens orders that it had closed that day. */
export async function reopenOrdersOnUndo(customerId: number, date: string) {
  await db.update(orders).set({ status: "open", doneAt: null })
    .where(and(eq(orders.customerId, customerId), eq(orders.status, "delivered"), eq(orders.date, date)));
}

/* ---------------- Empty cans ---------------- */

/** Cans each customer holds = starting cans + cans delivered − empties taken back. */
export async function cansHeld(): Promise<Map<number, number>> {
  const res = await db.execute(sql`
    select c.id, c.starting_cans + coalesce((
      select sum((d.std + d.disp) - coalesce(d.empties_returned, d.std + d.disp)) from deliveries d where d.customer_id = c.id
    ), 0) as held
    from customers c`);
  return new Map(res.rows.map((r) => [Number(r.id), Number(r.held)]));
}

/* ---------------- Delivery cycle ---------------- */

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export type CycleInfo = {
  customerId: number; every: number | null; manual: boolean; last: string | null; next: string | null;
  weekday: string | null; deliveries: number;
};

/**
 * Learns each customer's rhythm from the last 90 days: the usual gap between deliveries
 * (median, so one odd week doesn't throw it off) and a usual weekday when there is one.
 * A "delivers every N days" set on the customer always wins.
 */
export async function cycles(): Promise<Map<number, CycleInfo>> {
  const from = addDays(pkToday(), -90);
  const [cs, ds] = await Promise.all([
    db.select({ id: customers.id, cycleDays: customers.cycleDays }).from(customers).where(eq(customers.active, true)),
    db.select({ customerId: deliveries.customerId, date: deliveries.date }).from(deliveries)
      .where(gte(deliveries.date, from)).orderBy(asc(deliveries.date)),
  ]);
  const dates = new Map<number, string[]>();
  for (const d of ds) dates.set(d.customerId, [...(dates.get(d.customerId) ?? []), d.date]);

  const out = new Map<number, CycleInfo>();
  for (const c of cs) {
    const list = dates.get(c.id) ?? [];
    const gaps = list.slice(1).map((d, i) => dayDiff(list[i], d)).filter((g) => g > 0).sort((a, b) => a - b);
    const learned = gaps.length >= 2 ? gaps[Math.floor(gaps.length / 2)] : null;
    const every = c.cycleDays ?? learned;
    const last = list.at(-1) ?? null;
    // Usual weekday: at least 4 deliveries and 60%+ on the same day
    let weekday: string | null = null;
    if (list.length >= 4) {
      const counts = new Array(7).fill(0);
      for (const d of list) counts[new Date(`${d}T00:00:00Z`).getUTCDay()]++;
      const best = counts.indexOf(Math.max(...counts));
      if (counts[best] / list.length >= 0.6) weekday = WEEKDAYS[best];
    }
    out.set(c.id, {
      customerId: c.id, every, manual: c.cycleDays != null, last, deliveries: list.length,
      next: every && last ? addDays(last, every) : null, weekday,
    });
  }
  return out;
}

export type DueRow = {
  customer: Customer; cycle: CycleInfo; status: "ordered" | "due" | "overdue"; orderQty?: { std: number; disp: number };
};

/** Who to deliver to on a day: open orders for that day, plus customers whose cycle says that day (or earlier). */
export async function dueOn(day: string): Promise<DueRow[]> {
  const [cs, cyc, open, deliveredThatDay] = await Promise.all([
    db.select().from(customers).where(eq(customers.active, true)).orderBy(asc(customers.society), asc(customers.name)),
    cycles(),
    db.select().from(orders).where(and(eq(orders.status, "open"), lte(orders.date, day))),
    db.select({ customerId: deliveries.customerId }).from(deliveries).where(eq(deliveries.date, day)),
  ]);
  const done = new Set(deliveredThatDay.map((d) => d.customerId));
  const ordered = new Map<number, { std: number; disp: number }>();
  for (const o of open) if (o.customerId) ordered.set(o.customerId, { std: o.std, disp: o.disp });

  const rows: DueRow[] = [];
  for (const c of cs) {
    if (done.has(c.id)) continue;
    const cy = cyc.get(c.id)!;
    if (ordered.has(c.id)) { rows.push({ customer: c, cycle: cy, status: "ordered", orderQty: ordered.get(c.id) }); continue; }
    if (cy.next && cy.next <= day) rows.push({ customer: c, cycle: cy, status: cy.next < day ? "overdue" : "due" });
  }
  const rank = { ordered: 0, overdue: 1, due: 2 };
  return rows.sort((a, b) => rank[a.status] - rank[b.status]);
}

export async function orderCountsFor(date: string) {
  const rows = await db.select({ n: sql<string>`count(*)` }).from(orders)
    .where(and(eq(orders.status, "open"), lte(orders.date, date)));
  return Number(rows[0]?.n ?? 0);
}

