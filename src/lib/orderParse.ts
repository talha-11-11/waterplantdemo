// Reads a WhatsApp order message (Roman Urdu or English) into cans + date.
// Pure function: used on the server (webhook, saving) and in the browser (live preview).
import { addDays } from "./dates";
import { normalizePhone } from "./format";

const NUM_WORDS: Record<string, number> = {
  ek: 1, aik: 1, one: 1, do: 2, two: 2, teen: 3, tin: 3, three: 3, char: 4, chaar: 4, four: 4,
  panch: 5, paanch: 5, five: 5, chay: 6, chhe: 6, chhay: 6, six: 6, saat: 7, seven: 7,
  aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
};
const NUM = `(\\d{1,2}|${Object.keys(NUM_WORDS).join("|")})`;
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s] ?? 0);

const DISP = "(?:dispenser|dispensor|dispencer|dispanser|disp|bari|bara|big)";
const CAN = "(?:cans?|canes?|bottles?|botal|botals|bottal|botlen|botlain|gallon|galan|galon|gallons)";

export type ParsedOrder = {
  std: number; disp: number; date: string; phone: string | null;
  foundQty: boolean; dateWord: string;
};

export function parseOrderText(text: string, today: string): ParsedOrder {
  const t = ` ${text.toLowerCase().replace(/[.,!?؟،]/g, " ").replace(/\s+/g, " ")} `;

  const phoneMatch = text.match(/(?:\+?92|0)\s?3\d{2}[\s-]?\d{7}/);
  const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : null;
  const tNoPhone = phoneMatch ? t.replace(phoneMatch[0].toLowerCase(), " ") : t;

  let disp = 0;
  let std = 0;
  // "2 dispenser", "do bari bottle", "dispenser 2"
  for (const m of tNoPhone.matchAll(new RegExp(`\\b${NUM}\\s+${DISP}\\b`, "g"))) disp += toNum(m[1]);
  if (!disp) for (const m of tNoPhone.matchAll(new RegExp(`\\b${DISP}\\s+${NUM}\\b`, "g"))) disp += toNum(m[1]);
  // "3 can", "teen bottle" (not counted again if it was "2 dispenser bottle")
  const stdText = tNoPhone.replace(new RegExp(`\\b${NUM}\\s+${DISP}(\\s+${CAN})?`, "g"), " ");
  for (const m of stdText.matchAll(new RegExp(`\\b${NUM}\\s+(?:standard\\s+|normal\\s+|choti\\s+|chota\\s+)?${CAN}\\b`, "g"))) std += toNum(m[1]);
  if (!disp && new RegExp(`\\b${DISP}\\b`).test(tNoPhone)) disp = 1;
  // A lone number like "3 bhej do" or "3 chahiye"
  if (!std && !disp) {
    const lone = tNoPhone.match(/\b(\d{1,2})\b/);
    if (lone && Number(lone[1]) > 0 && Number(lone[1]) <= 50) std = Number(lone[1]);
  }

  let date = today;
  let dateWord = "";
  if (/\b(parson|parso|day after)\b/.test(t)) { date = addDays(today, 2); dateWord = "day after tomorrow"; }
  else if (/\b(kal|kl|tomorrow|tmrw|tomorow|tommorow)\b/.test(t)) { date = addDays(today, 1); dateWord = "tomorrow"; }
  else if (/\b(aaj|aj|today|abhi|now|jaldi)\b/.test(t)) { dateWord = "today"; }

  return { std, disp, date, phone, foundQty: std + disp > 0, dateWord };
}
