// Message texts opened in the owner's own WhatsApp (free, no API). Safe for client components.
import { monthLabel, shortDate } from "./dates";
import { rs } from "./format";

/** Short delivery message: just the date and the cans. */
export function deliveryMessage(p: { date: string; std: number; disp: number; business: string }): string {
  const cans = p.disp
    ? [p.std && `${p.std} standard`, `${p.disp} dispenser`].filter(Boolean).join(" + ")
    : `${p.std}`;
  return `${p.business}\n${shortDate(p.date)}: ${cans} can deliver huay. Shukriya!`;
}

type PaySettings = {
  jazzcashNumber: string; jazzcashTitle: string; easypaisaNumber: string; easypaisaTitle: string; paymentInfo: string;
};

/** Payment accounts as short lines, e.g. "JazzCash: 0300-1234567 (Account name)". */
export function paymentLines(s: PaySettings): string[] {
  const lines: string[] = [];
  if (s.jazzcashNumber) lines.push(`JazzCash: ${s.jazzcashNumber}${s.jazzcashTitle ? ` (${s.jazzcashTitle})` : ""}`);
  if (s.easypaisaNumber) lines.push(`Easypaisa: ${s.easypaisaNumber}${s.easypaisaTitle ? ` (${s.easypaisaTitle})` : ""}`);
  if (s.paymentInfo) lines.push(s.paymentInfo);
  return lines;
}

export function billMessage(p: {
  name: string; month: string; std: number; disp: number; charges: number; previousBalance: number;
  paid: number; totalDue: number; pay: string[]; business: string; link: string;
}): string {
  const cans = p.disp ? `${p.std} standard + ${p.disp} dispenser` : `${p.std}`;
  return [
    `Assalam o Alaikum ${p.name}!`,
    `${monthLabel(p.month)} ka bill:`,
    `${cans} can = ${rs(p.charges)}`,
    ...(p.previousBalance ? [`Pichla baqaya: ${rs(p.previousBalance)}`] : []),
    ...(p.paid ? [`Jama (paid): ${rs(p.paid)}`] : []),
    `Total due: ${rs(Math.max(p.totalDue, 0))}`,
    ...(p.pay.length ? ["", ...p.pay, "ya delivery par cash dein."] : []),
    `Bill: ${p.link}`,
    `Shukriya, ${p.business}`,
  ].join("\n");
}

// In the demo, customers have placeholder numbers, so WhatsApp opens its chat picker
// (send to yourself to see the message) instead of messaging a real number.
export const waLink = (phone: string, text: string) =>
  process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ? `https://wa.me/?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
