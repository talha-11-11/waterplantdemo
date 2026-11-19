import { safeEqual } from "@/lib/auth";
import { monthOf, pkToday, prevMonth, summaryPeriodDue, dayOf } from "@/lib/dates";
import { sendBills, sendSummaries } from "@/lib/notify";
import { waMode } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs once a day (vercel.json: 03:00 UTC = 08:00 Pakistan).
 *  - 11th: summary for days 1–10
 *  - 21st: summary for days 11–20
 *  - 1st:  monthly bills (PDF) for last month
 * Optional ?date=YYYY-MM-DD lets you test a specific day.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const override = url.searchParams.get("date");
  const today = override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : pkToday();
  const out: Record<string, unknown> = { today };

  // Default setup uses the free "open WhatsApp and tap send" flow, so the paid API job only
  // runs when WhatsApp API keys are configured (or ?force=1 for testing in log-only mode).
  if (waMode() !== "live" && url.searchParams.get("force") !== "1") {
    return Response.json({ ...out, note: "WhatsApp API not configured, auto-send skipped" });
  }

  const period = summaryPeriodDue(today);
  if (period) out.summary = { ...period, ...(await sendSummaries(period.from, period.to)) };

  if (dayOf(today) === 1) {
    const month = prevMonth(monthOf(today));
    out.bills = { month, ...(await sendBills(month)) };
  }

  if (!out.summary && !out.bills) out.note = "Nothing scheduled today";
  return Response.json(out);
}
