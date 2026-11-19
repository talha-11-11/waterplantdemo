import { getBillWithDetails } from "@/lib/billing";
import { getSettings } from "@/lib/data";
import { billPdf } from "@/lib/pdf";

export const runtime = "nodejs";

// Protected by middleware (owner session required).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Bad id", { status: 400 });
  const data = await getBillWithDetails(id);
  if (!data) return new Response("Not found", { status: 404 });
  const pdf = await billPdf({ bill: data.bill, customer: data.customer, items: data.items, settings: await getSettings() });
  const name = `Bill-${data.bill.month}-${data.customer.name.replace(/[^\w]+/g, "-")}.pdf`;
  return new Response(pdf as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
