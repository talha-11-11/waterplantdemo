// All business dates are 'YYYY-MM-DD' strings in Pakistan time.
export const TZ = "Asia/Karachi";

export function pkToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export const monthOf = (d: string) => d.slice(0, 7);
export const dayOf = (d: string) => Number(d.slice(8, 10));
export const monthStart = (m: string) => `${m}-01`;

export function nextMonthStart(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
}

export function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

export function addDays(d: string, n: number): string {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
}

export function shortDate(d: string): string {
  const mo = Number(d.slice(5, 7));
  return `${dayOf(d)} ${MONTHS[mo - 1].slice(0, 3)}`;
}

/** "1–10 Nov" style label for a period inside one month */
export function periodLabel(from: string, to: string): string {
  return `${dayOf(from)}-${dayOf(to)} ${MONTHS[Number(from.slice(5, 7)) - 1].slice(0, 3)}`;
}

/**
 * 10-day summary schedule. The cron runs every morning; on the 11th it
 * summarises days 1–10, on the 21st days 11–20. Days 21–end are covered
 * by the monthly bill sent on the 1st.
 */
export function summaryPeriodDue(today: string): { from: string; to: string } | null {
  const m = monthOf(today);
  const day = dayOf(today);
  if (day === 11) return { from: `${m}-01`, to: `${m}-10` };
  if (day === 21) return { from: `${m}-11`, to: `${m}-20` };
  return null;
}

export const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
export const isValidMonth = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
