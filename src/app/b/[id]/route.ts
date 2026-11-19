import { billToken, safeEqual } from "@/lib/auth";
import { getBillWithDetails } from "@/lib/billing";
import { getSettings } from "@/lib/data";
import { billPdf } from "@/lib/pdf";

export const runtime = "nodejs";

// Public, customer-facing bill link: /b/123?t=<signed token>. No login needed, token required.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!Number.isInteger(id) || id <= 0 || !safeEqual(t, await billToken(id))) {
    return new Response("Link not valid", { status: 404 });
  }
  const data = await getBillWithDetails(id);
  if (!data) return new Response("Link not valid", { status: 404 });
  const pdf = await billPdf({ bill: data.bill, customer: data.customer, items: data.items, settings: await getSettings() });
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Bill-${data.bill.month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
