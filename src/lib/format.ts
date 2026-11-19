export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-US")}`;

/** Accepts 0300-1234567, 03001234567, +92 300 1234567, 923001234567 → 923001234567 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("03") && d.length === 11) d = "92" + d.slice(1);
  if (d.startsWith("3") && d.length === 10) d = "92" + d;
  return /^92\d{10}$/.test(d) ? d : null;
}

/** 923001234567 → 0300-1234567 */
export function displayPhone(p: string): string {
  if (/^92\d{10}$/.test(p)) return `0${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
}

export function cansText(std: number, disp: number): string {
  const parts: string[] = [];
  if (std) parts.push(`${std} standard`);
  if (disp) parts.push(`${disp} dispenser`);
  return parts.length ? parts.join(" + ") : "No cans";
}
