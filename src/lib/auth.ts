// Signed session tokens. Works in Edge middleware and Node (Web Crypto only).
export const SESSION_COOKIE = "ppp_s2";
const MAX_AGE_DAYS = 90;
export const SESSION_MAX_AGE = 60 * 60 * 24 * MAX_AGE_DAYS;

export type SessionData = { u: number; r: "superadmin" | "admin"; v: number; exp: number };

const enc = new TextEncoder();

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64url(s: string) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmac(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(data: Omit<SessionData, "exp">): Promise<string> {
  const body = b64url(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }));
  return `${body}.${await hmac(`s:${body}`)}`;
}

/** Checks signature and expiry only. Server code also checks the user in the database. */
export async function readSession(token: string | undefined): Promise<SessionData | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, await hmac(`s:${body}`))) return null;
  try {
    const d = JSON.parse(fromB64url(body)) as SessionData;
    if (!d.u || !d.exp || d.exp < Date.now() / 1000) return null;
    return d;
  } catch {
    return null;
  }
}

/** Signed token so a customer can open their own bill PDF without logging in. */
export async function billToken(billId: number): Promise<string> {
  return (await hmac(`bill:${billId}`)).slice(0, 32);
}
