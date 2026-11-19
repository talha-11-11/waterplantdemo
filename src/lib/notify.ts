import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { billsForMonth, generateBills, getBillWithDetails } from "./billing";
import { deliveryTotals, getSettings } from "./data";
import { monthLabel, monthOf, monthStart, periodLabel } from "./dates";
import { rs } from "./format";
import { billPdf } from "./pdf";
import { paymentLines } from "./messages";
import { TEMPLATE_BILL, TEMPLATE_SUMMARY, sendTemplate, uploadPdf, waMode } from "./whatsapp";

const { customers, messageLog, bills } = schema;

/* ---- Message texts: these MUST match the templates approved in Meta (see README) ---- */

export function summaryParams(p: {
  name: string; period: string; std: number; disp: number; amount: number; monthToDate: number; business: string;
}) {
  return [p.name, p.period, p.std, p.disp, rs(p.amount), rs(p.monthToDate), p.business];
}
export function summaryText(params: (string | number)[]) {
  const [n, per, s, d, amt, mtd, biz] = params;
  return `Assalam o Alaikum ${n}! ${per} ke dauran aap ko ${s} standard aur ${d} dispenser cans deliver huay, total ${amt}. Is mahine ab tak ka bill: ${mtd}. Shukriya, ${biz}`;
}

export function billParams(p: { name: string; month: string; totalDue: number; paymentInfo: string; business: string }) {
  return [p.name, monthLabel(p.month), rs(Math.max(p.totalDue, 0)), p.paymentInfo, p.business];
}
export function billText(params: (string | number)[]) {
  const [n, m, due, pay, biz] = params;
  return `Assalam o Alaikum ${n}! Aap ka ${m} ka bill attached hai. Total due: ${due}. Payment: ${pay}, ya delivery par cash dein. Shukriya, ${biz}`;
}

/* ---- Idempotency: never message the same customer twice for the same period ---- */

async function alreadyDone(kind: string, period: string): Promise<Set<number>> {
  const rows = await db
    .select({ customerId: messageLog.customerId })
    .from(messageLog)
    .where(and(eq(messageLog.kind, kind), eq(messageLog.period, period), inArray(messageLog.status, ["sent", "dry_run"])));
  return new Set(rows.map((r) => r.customerId!).filter(Boolean));
}

async function log(customerId: number, kind: string, period: string, status: string, detail: string) {
  await db.insert(messageLog).values({ customerId, kind, period, status, detail: detail.slice(0, 2000) });
}

export type RunResult = { mode: string; sent: number; dryRun: number; failed: number; skipped: number; errors: string[] };
const emptyResult = (): RunResult => ({ mode: waMode(), sent: 0, dryRun: 0, failed: 0, skipped: 0, errors: [] });

/** 10-day summary for every active customer who got cans in [from, to]. */
export async function sendSummaries(from: string, to: string): Promise<RunResult> {
  const result = emptyResult();
  const period = `${from}..${to}`;
  const s = await getSettings();
  const [periodTotals, monthTotals, done, list] = await Promise.all([
    deliveryTotals(from, to),
    deliveryTotals(monthStart(monthOf(from)), to),
    alreadyDone("summary", period),
    db.select().from(customers).where(eq(customers.active, true)),
  ]);

  for (const c of list) {
    const t = periodTotals.get(c.id);
    if (!t || t.days === 0 || done.has(c.id)) { result.skipped++; continue; }
    const params = summaryParams({
      name: c.name, period: periodLabel(from, to), std: t.std, disp: t.disp, amount: t.amount,
      monthToDate: monthTotals.get(c.id)?.amount ?? t.amount, business: s.businessName,
    });
    if (result.mode === "dry_run") {
      await log(c.id, "summary", period, "dry_run", summaryText(params));
      result.dryRun++;
      continue;
    }
    try {
      const id = await sendTemplate({ to: c.phone, template: TEMPLATE_SUMMARY(), params });
      await log(c.id, "summary", period, "sent", `wamid=${id} | ${summaryText(params)}`);
      result.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await log(c.id, "summary", period, "failed", msg);
      result.failed++;
      result.errors.push(`${c.name}: ${msg}`);
    }
  }
  return result;
}

/** Generate bills for the month and send each unsent one as a PDF on WhatsApp. */
export async function sendBills(month: string): Promise<RunResult> {
  const result = emptyResult();
  await generateBills(month);
  const s = await getSettings();
  const done = await alreadyDone("bill", month);
  const rows = await billsForMonth(month);

  for (const { bill, customer } of rows) {
    if (bill.sentAt || done.has(customer.id) || !customer.active) { result.skipped++; continue; }
    const params = billParams({
      name: customer.name, month, totalDue: bill.totalDue, paymentInfo: paymentLines(s).join(", ") || s.paymentInfo, business: s.businessName,
    });
    if (result.mode === "dry_run") {
      await log(customer.id, "bill", month, "dry_run", billText(params));
      result.dryRun++;
      continue;
    }
    try {
      const full = await getBillWithDetails(bill.id);
      const pdf = await billPdf({ bill, customer, items: full?.items ?? [], settings: s });
      const filename = `Bill-${month}-${customer.name.replace(/[^\w]+/g, "-")}.pdf`;
      const mediaId = await uploadPdf(pdf, filename);
      const id = await sendTemplate({
        to: customer.phone, template: TEMPLATE_BILL(), params, document: { id: mediaId, filename },
      });
      await db.update(bills).set({ sentAt: new Date() }).where(eq(bills.id, bill.id));
      await log(customer.id, "bill", month, "sent", `wamid=${id} | ${billText(params)}`);
      result.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await log(customer.id, "bill", month, "failed", msg);
      result.failed++;
      result.errors.push(`${customer.name}: ${msg}`);
    }
  }
  return result;
}
