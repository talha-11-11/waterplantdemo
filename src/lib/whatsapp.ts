import "server-only";

/**
 * Minimal WhatsApp Cloud API client.
 * Env: WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_API_VERSION (default v23.0),
 *      WA_TEMPLATE_LANG (default "en"), WA_DRY_RUN ("true" = log only, send nothing).
 */
const version = () => process.env.WA_API_VERSION || "v23.0";
const phoneId = () => process.env.WA_PHONE_NUMBER_ID || "";
const token = () => process.env.WA_ACCESS_TOKEN || "";

export function waMode(): "live" | "dry_run" {
  if (process.env.WA_DRY_RUN === "true") return "dry_run";
  return phoneId() && token() ? "live" : "dry_run";
}

// Template parameters may not contain newlines, tabs or 4+ spaces in a row.
const clean = (s: string) => s.replace(/[\n\r\t]+/g, " ").replace(/ {4,}/g, "   ").trim() || "-";

async function graph(path: string, init: RequestInit) {
  const res = await fetch(`https://graph.facebook.com/${version()}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message || res.statusText;
    throw new Error(`WhatsApp API ${res.status}: ${msg}`);
  }
  return body as Record<string, unknown>;
}

export async function uploadPdf(bytes: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([bytes as BlobPart], { type: "application/pdf" }), filename);
  const res = await graph(`${phoneId()}/media`, { method: "POST", body: form });
  return String(res.id);
}

export async function sendTemplate(opts: {
  to: string;
  template: string;
  params: (string | number)[];
  document?: { id: string; filename: string };
}): Promise<string> {
  const components: unknown[] = [];
  if (opts.document) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { id: opts.document.id, filename: opts.document.filename } }],
    });
  }
  components.push({
    type: "body",
    parameters: opts.params.map((p) => ({ type: "text", text: clean(String(p)) })),
  });
  const res = await graph(`${phoneId()}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: opts.to,
      type: "template",
      template: { name: opts.template, language: { code: process.env.WA_TEMPLATE_LANG || "en" }, components },
    }),
  });
  const msgs = res.messages as { id: string }[] | undefined;
  return msgs?.[0]?.id ?? "";
}

export const TEMPLATE_SUMMARY = () => process.env.WA_TEMPLATE_SUMMARY || "delivery_summary";
export const TEMPLATE_BILL = () => process.env.WA_TEMPLATE_BILL || "monthly_bill";
