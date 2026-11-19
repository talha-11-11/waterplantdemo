import { createHmac, timingSafeEqual } from "node:crypto";
import { orderFromMessage } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional WhatsApp inbox (WhatsApp Cloud API webhook).
 * Customers' text messages to the business number become open orders automatically.
 * Env: WA_VERIFY_TOKEN (any text you choose, entered in Meta), WA_APP_SECRET (Meta app secret).
 */

// Meta calls this once to verify the webhook URL
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.WA_VERIFY_TOKEN;
  if (token && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === token) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = { from?: string; type?: string; text?: { body?: string } };
type WaChange = { value?: { messages?: WaMessage[]; contacts?: { wa_id?: string; profile?: { name?: string } }[] } };

export async function POST(req: Request) {
  const secret = process.env.WA_APP_SECRET;
  const raw = await req.text();
  // Only accept messages signed by Meta with our app secret
  const sig = req.headers.get("x-hub-signature-256") || "";
  if (!secret) return new Response("Not configured", { status: 503 });
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new Response("Bad signature", { status: 401 });
  }

  let body: { entry?: { changes?: WaChange[] }[] };
  try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  let created = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const names = new Map((change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? ""]));
      for (const m of change.value?.messages ?? []) {
        const text = m.type === "text" ? m.text?.body?.trim() : "";
        if (!text || !m.from) continue;
        await orderFromMessage({ text, fromPhone: m.from, fromName: names.get(m.from) || "", source: "whatsapp", by: "whatsapp" });
        created++;
      }
    }
  }
  // Always 200 quickly so Meta doesn't retry
  return Response.json({ ok: true, created });
}
