import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Bill, Customer, Delivery, Settings } from "@/db/schema";
import { monthLabel, shortDate } from "./dates";
import { displayPhone, rs } from "./format";

const BLUE = rgb(0x03 / 255, 0x69 / 255, 0xa1 / 255);
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.28, 0.33, 0.41);
const LINE = rgb(0.89, 0.91, 0.94);
const TINT = rgb(0.94, 0.98, 1);

// Standard PDF fonts only cover Latin characters; replace anything else.
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

const fileCache = new Map<string, Uint8Array | null>();
async function publicFile(...parts: string[]): Promise<Uint8Array | null> {
  const key = parts.join("/");
  if (fileCache.has(key)) return fileCache.get(key)!;
  let data: Uint8Array | null = null;
  try { data = await readFile(path.join(process.cwd(), "public", ...parts)); } catch { data = null; }
  fileCache.set(key, data);
  return data;
}
const logo = () => publicFile("logo.png");

/** Official payment logos, if the owner added them to public/pay/ (png or jpg). */
async function payLogo(name: "jazzcash" | "easypaisa"): Promise<Uint8Array | null> {
  return (await publicFile("pay", `${name}.png`)) ?? (await publicFile("pay", `${name}.jpg`));
}
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50;

function text(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
  page.drawText(safe(s), { x, y, size, font, color });
}
function right(page: PDFPage, s: string, xRight: number, y: number, size: number, font: PDFFont, color = INK) {
  const t = safe(s);
  page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font, color });
}

export async function billPdf(opts: {
  bill: Bill; customer: Customer; items: Delivery[]; settings: Settings;
}): Promise<Uint8Array> {
  const { bill, customer, items, settings } = opts;
  const doc = await PDFDocument.create();
  doc.setTitle(`${settings.businessName} bill ${bill.month} - ${customer.name}`);
  const page = doc.addPage([595, 842]); // A4
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, M = 48;

  // Header band
  page.drawRectangle({ x: 0, y: 842 - 120, width: W, height: 120, color: BLUE });
  const logoBytes = await logo();
  if (logoBytes) {
    const img = await doc.embedPng(logoBytes);
    page.drawCircle({ x: W - M - 38, y: 842 - 60, size: 40, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: W - M - 74, y: 842 - 96, width: 72, height: 72 });
  }
  text(page, settings.businessName, M, 842 - 58, 24, bold, rgb(1, 1, 1));
  text(page, `Monthly bill - ${monthLabel(bill.month)}`, M, 842 - 82, 12, reg, rgb(0.88, 0.95, 1));
  if (settings.ownerPhone) text(page, `Contact: ${displayPhone(settings.ownerPhone)}`, M, 842 - 100, 10, reg, rgb(0.88, 0.95, 1));

  // Bill to / bill no
  let y = 842 - 160;
  text(page, "BILL TO", M, y, 9, bold, MUTED);
  right(page, "BILL #", W - M, y, 9, bold, MUTED);
  y -= 18;
  text(page, customer.name, M, y, 14, bold);
  right(page, `${bill.month.replace("-", "")}-${String(customer.id).padStart(4, "0")}`, W - M, y, 14, bold);
  y -= 16;
  text(page, [customer.society, customer.address].filter(Boolean).join(", "), M, y, 10, reg, MUTED);
  y -= 14;
  text(page, displayPhone(customer.phone), M, y, 10, reg, MUTED);
  if (customer.startingCans > 0) {
    y -= 14;
    text(page, `Empty cans with customer: ${customer.startingCans}`, M, y, 10, reg, MUTED);
  }

  // Delivery table
  y -= 30;
  const cols = { date: M + 12, std: M + 230, disp: M + 340, amt: W - M - 12 };
  page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 24, color: TINT });
  text(page, "Date", cols.date, y, 10, bold, MUTED);
  right(page, bill.disp ? "Standard" : "Cans", bill.disp ? cols.std : cols.disp, y, 10, bold, MUTED);
  if (bill.disp) right(page, "Dispenser", cols.disp, y, 10, bold, MUTED);
  right(page, "Amount", cols.amt, y, 10, bold, MUTED);
  y -= 24;

  const rowH = items.length > 22 ? 13 : 16;
  const size = items.length > 22 ? 9 : 10;
  if (items.length === 0) {
    text(page, "No deliveries this month", cols.date, y, size, reg, MUTED);
    y -= rowH;
  }
  for (const it of items) {
    text(page, shortDate(it.date), cols.date, y, size, reg);
    right(page, String(it.std), bill.disp ? cols.std : cols.disp, y, size, reg);
    if (bill.disp) right(page, String(it.disp), cols.disp, y, size, reg);
    right(page, rs(it.amount), cols.amt, y, size, reg);
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + rowH - 4 }, end: { x: W - M, y: y + rowH - 4 }, thickness: 0.5, color: LINE });
  }

  // Totals
  // Show "x Rs 60" only when every delivery used the same price
  const uniform = (k: "priceStd" | "priceDisp") =>
    items.length && items.every((i) => i[k] === items[0][k]) ? items[0][k] : undefined;
  const stdPrice = uniform("priceStd");
  const dispPrice = uniform("priceDisp");
  y -= 14;
  const line = (label: string, value: string, b = false) => {
    text(page, label, M + 220, y, 11, b ? bold : reg, b ? INK : MUTED);
    right(page, value, W - M - 12, y, 11, b ? bold : reg);
    y -= 18;
  };
  const stdAmt = items.reduce((s, i) => s + i.std * i.priceStd, 0);
  const dispAmt = items.reduce((s, i) => s + i.disp * i.priceDisp, 0);
  line(`${bill.std} standard cans${stdPrice ? ` x Rs ${stdPrice}` : ""}`, rs(stdAmt));
  if (bill.disp) line(`${bill.disp} dispenser cans${dispPrice ? ` x Rs ${dispPrice}` : ""}`, rs(dispAmt));
  line("This month", rs(bill.charges), true);
  line("Previous balance", rs(bill.previousBalance));
  line("Paid this month", bill.paymentsInMonth ? `- ${rs(bill.paymentsInMonth)}` : rs(0));
  page.drawLine({ start: { x: M + 220, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 1, color: LINE });
  y -= 6;
  text(page, "Total due", M + 220, y, 14, bold);
  right(page, rs(Math.max(bill.totalDue, 0)), W - M - 12, y, 18, bold, BLUE);
  if (bill.totalDue < 0) {
    y -= 18;
    text(page, `Advance / credit: ${rs(-bill.totalDue)}`, M + 220, y, 10, reg, MUTED);
  }

  // Payment box: one row per account (JazzCash, Easypaisa), then other note + cash
  const accounts = [
    { key: "jazzcash" as const, label: "JazzCash", number: settings.jazzcashNumber, title: settings.jazzcashTitle },
    { key: "easypaisa" as const, label: "Easypaisa", number: settings.easypaisaNumber, title: settings.easypaisaTitle },
  ].filter((a) => a.number);
  const payRowH = 58;
  const extra = [settings.paymentInfo, "Or pay cash at delivery"].filter(Boolean);
  const boxH = 30 + accounts.length * payRowH + extra.length * 16;
  y -= 30;
  page.drawRectangle({ x: M, y: y - boxH + 14, width: W - 2 * M, height: boxH, color: TINT });
  text(page, "How to pay", M + 14, y, 11, bold, BLUE);
  y -= 12;
  for (const a of accounts) {
    y -= payRowH;
    const bytes = await payLogo(a.key);
    if (bytes) {
      const img = isPng(bytes) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const h = 50, w = Math.min(90, (img.width / img.height) * h);
      page.drawImage(img, { x: M + 14, y: y + 2, width: w, height: h });
    } else {
      // No logo file added yet: plain label in a white box
      page.drawRectangle({ x: M + 14, y: y + 14, width: 90, height: 26, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 1 });
      text(page, a.label, M + 22, y + 23, 11, bold, INK);
    }
    text(page, `${a.label}: ${a.number}`, M + 118, y + 28, 14, bold, INK);
    if (a.title) text(page, `Account name: ${a.title}`, M + 118, y + 12, 10, reg, MUTED);
  }
  y -= 8;
  for (const e of extra) {
    y -= 16;
    text(page, e, M + 14, y, 10, reg, INK);
  }

  // Footer: app credit + PokitBio contact
  page.drawLine({ start: { x: M, y: 62 }, end: { x: W - M, y: 62 }, thickness: 0.5, color: LINE });
  text(page, `${settings.businessName} app  |  Powered by PokitBio`, M, 44, 9, bold, INK);
  text(page, "WhatsApp: +92 339 6886174   |   pokitbio.com", M, 30, 9, reg, MUTED);
  const pb = await publicFile("pokitbio.png");
  if (pb) {
    const img = await doc.embedPng(pb);
    const h = 30, w = (img.width / img.height) * h;
    page.drawImage(img, { x: W - M - w, y: 26, width: w, height: h });
  }
  return doc.save();
}
