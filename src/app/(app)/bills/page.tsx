import Link from "next/link";
import { headers } from "next/headers";
import { sendBillsAction } from "@/app/actions";
import BillShareButton from "@/components/BillShareButton";
import RunButton from "@/components/RunButton";
import { billToken } from "@/lib/auth";
import { billsForMonth, generateBills } from "@/lib/billing";
import { getSettings } from "@/lib/data";
import { isValidMonth, monthLabel, monthOf, pkToday, prevMonth } from "@/lib/dates";
import { cansText, rs } from "@/lib/format";
import { billMessage, paymentLines, waLink } from "@/lib/messages";
import { waMode } from "@/lib/whatsapp";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const current = monthOf(pkToday());
  const month = m && isValidMonth(m) ? m : prevMonth(current);
  await generateBills(month); // always up to date with the latest deliveries and payments
  const [rows, s, h] = await Promise.all([billsForMonth(month), getSettings(), headers()]);
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const total = rows.reduce((n, r) => n + Math.max(r.bill.totalDue, 0), 0);
  const unsent = rows.filter((r) => !r.bill.sentAt).length;
  const months = [current, prevMonth(current), prevMonth(prevMonth(current))];
  const live = waMode() === "live";

  const shareLinks = await Promise.all(rows.map(async ({ bill, customer }) => {
    const link = `${origin}/b/${bill.id}?t=${await billToken(bill.id)}`;
    return waLink(customer.phone, billMessage({
      name: customer.name, month, std: bill.std, disp: bill.disp, charges: bill.charges,
      previousBalance: bill.previousBalance, paid: bill.paymentsInMonth, totalDue: bill.totalDue,
      pay: paymentLines(s), business: s.businessName, link,
    }));
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Monthly bills</h1>
      <div className="flex gap-2">
        {months.map((mm) => (
          <Link key={mm} href={`/bills?m=${mm}`}
            className={`flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${mm === month ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {monthLabel(mm).split(" ")[0]}
          </Link>
        ))}
      </div>

      <section className="card space-y-3 p-4">
        <p className="text-sm text-slate-600">
          Bills update by themselves with every delivery and payment. Tap <b>Send</b> next to each customer. WhatsApp opens with the bill message and a link to their PDF. Just tap send.
        </p>
        {live && rows.length > 0 && unsent > 0 && (
          <RunButton action={sendBillsAction} fields={{ month }}
            label={`Auto-send ${unsent} bill${unsent === 1 ? "" : "s"} via WhatsApp API`}
            confirmText={`Yes, send ${monthLabel(month)} bills to customers`} />
        )}
      </section>

      {rows.length > 0 ? (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{rows.length} bills · {unsent} not sent</h2>
            <span className="font-semibold">{rs(total)} due</span>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.map(({ bill, customer }, i) => (
              <li key={bill.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link href={`/customers/${customer.id}`} className="truncate font-medium hover:underline">{customer.name}</Link>
                  <p className="text-xs text-slate-600">
                    {bill.disp ? cansText(bill.std, bill.disp) : `${bill.std} cans`} = {rs(bill.charges)}
                    {bill.previousBalance ? ` · old ${rs(bill.previousBalance)}` : ""}
                    {bill.paymentsInMonth ? ` · paid ${rs(bill.paymentsInMonth)}` : ""}
                    {" · "}<a href={`/api/bills/${bill.id}/pdf`} target="_blank" className="font-semibold text-brand hover:underline">due {rs(bill.totalDue)} (PDF)</a>
                  </p>
                </div>
                <BillShareButton billId={bill.id} href={shareLinks[i]} sent={!!bill.sentAt} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="card p-6 text-center text-slate-600">No bills made for {monthLabel(month)} yet.</p>
      )}
    </div>
  );
}
