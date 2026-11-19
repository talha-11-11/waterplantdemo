import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cancelOrder, orderFromCycle } from "@/app/actions";
import { ChatIcon } from "@/components/icons";
import { ManualOrderForm, PasteOrderForm } from "@/components/OrderForms";
import { getSettings } from "@/lib/data";
import { addDays, pkToday, shortDate } from "@/lib/dates";
import { cansText, displayPhone } from "@/lib/format";
import { waLink } from "@/lib/messages";
import { dueOn, listOrders } from "@/lib/orders";

const TABS = [
  { key: "open", label: "Open" },
  { key: "tomorrow", label: "Due tomorrow" },
  { key: "new", label: "+ New" },
  { key: "done", label: "Done" },
] as const;

const SOURCE: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: "WhatsApp", cls: "bg-green-100 text-green-800" },
  paste: { label: "WhatsApp (pasted)", cls: "bg-green-50 text-green-800" },
  manual: { label: "Manual", cls: "bg-slate-100 text-slate-700" },
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "open" } = await searchParams;
  const today = pkToday();
  const tomorrow = addDays(today, 1);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Order views">
        {TABS.map((t) => (
          <Link key={t.key} href={`/orders?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${tab === t.key ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "tomorrow" ? <Tomorrow tomorrow={tomorrow} />
        : tab === "new" ? <NewOrder today={today} tomorrow={tomorrow} />
        : <OrderList status={tab === "done" ? "done" : "open"} today={today} />}
    </div>
  );
}

async function OrderList({ status, today }: { status: "open" | "done"; today: string }) {
  const rows = await listOrders(status);
  if (!rows.length) {
    return (
      <div className="card p-6 text-center text-slate-600">
        {status === "open" ? <>No open orders. <Link href="/orders?tab=new" className="font-semibold text-brand">Add one</Link> or paste a WhatsApp message.</> : "No finished orders yet."}
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map(({ o, c }) => {
        const when = o.date < today ? "Late" : o.date === today ? "Today" : o.date === addDays(today, 1) ? "Tomorrow" : shortDate(o.date);
        const src = SOURCE[o.source] ?? SOURCE.manual;
        return (
          <li key={o.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{c ? c.name : o.fromName || (o.fromPhone ? displayPhone(o.fromPhone) : "Unknown customer")}</p>
                <p className="text-sm text-slate-600">{c ? `${c.society} · ${c.address}` : "Not in customer list"}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status === "done" ? (o.status === "delivered" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700") : o.date < today ? "bg-red-100 text-red-800" : "bg-brand-tint text-brand-ink"}`}>
                {status === "done" ? (o.status === "delivered" ? "Delivered" : "Cancelled") : when}
              </span>
            </div>
            <p className="text-sm"><b>{o.disp ? cansText(o.std, o.disp) : `${o.std} cans`}</b> · {shortDate(o.date)} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-semibold ${src.cls}`}>{src.label}</span></p>
            {o.rawText && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">&ldquo;{o.rawText}&rdquo;</p>}
            {o.note && <p className="text-xs text-slate-600">{o.note}</p>}
            {status === "open" && (
              <div className="flex gap-2">
                {c && o.date <= today ? (
                  <Link href={`/?s=${encodeURIComponent(c.society)}`} className="btn-primary h-10 flex-1">Deliver on route</Link>
                ) : c ? (
                  <span className="flex h-10 flex-1 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-600">Shows on route on {shortDate(o.date)}</span>
                ) : (
                  <Link href="/customers/new" className="btn-outline h-10 flex-1">Add as customer</Link>
                )}
                <form action={cancelOrder}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-outline h-10" aria-label="Cancel order">Cancel</button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function Tomorrow({ tomorrow }: { tomorrow: string }) {
  const [rows, s] = await Promise.all([dueOn(tomorrow), getSettings()]);
  const label = { ordered: "Ordered", due: "Due by cycle", overdue: "Overdue" } as const;
  const cls = { ordered: "bg-green-100 text-green-800", due: "bg-brand-tint text-brand-ink", overdue: "bg-red-100 text-red-800" } as const;
  const listText = [`${s.businessName}: kal (${shortDate(tomorrow)}) ki delivery`, ...rows.map((r, i) =>
    `${i + 1}. ${r.customer.name} (${r.customer.society}) - ${r.orderQty ? cansText(r.orderQty.std, r.orderQty.disp) : cansText(r.customer.defaultStd, r.customer.defaultDisp)}${r.status === "ordered" ? " [order]" : ""}`)].join("\n");

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Tomorrow ({shortDate(tomorrow)}): open orders, plus customers whose usual delivery cycle says tomorrow.
        The cycle is learned from each customer&apos;s past deliveries, or set by hand on the customer.
      </p>
      {rows.length > 0 && (
        <a href={waLink(s.ownerPhone || "", listText)} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
          <ChatIcon className="size-4" /> Send me this list on WhatsApp
        </a>
      )}
      {rows.length === 0 && <div className="card p-6 text-center text-slate-600">Nobody is due tomorrow.</div>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.customer.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/customers/${r.customer.id}`} className="font-semibold hover:underline">{r.customer.name}</Link>
                <p className="text-sm text-slate-600">{r.customer.society} · {r.customer.address}</p>
                <p className="text-xs text-slate-600">
                  {r.cycle.every ? `Every ${r.cycle.every} day${r.cycle.every > 1 ? "s" : ""}${r.cycle.manual ? " (set)" : ""}` : "No cycle yet"}
                  {r.cycle.weekday ? ` · usually ${r.cycle.weekday}` : ""}
                  {r.cycle.last ? ` · last ${shortDate(r.cycle.last)}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls[r.status]}`}>{label[r.status]}</span>
            </div>
            <p className="text-sm"><b>{r.orderQty ? cansText(r.orderQty.std, r.orderQty.disp) : cansText(r.customer.defaultStd, r.customer.defaultDisp)}</b></p>
            {r.status !== "ordered" && (
              <div className="flex gap-2">
                <form action={orderFromCycle} className="flex-1">
                  <input type="hidden" name="customerId" value={r.customer.id} />
                  <input type="hidden" name="date" value={tomorrow} />
                  <button className="btn-primary h-10 w-full">Add to tomorrow</button>
                </form>
                <a className="btn-outline h-10" target="_blank" rel="noopener noreferrer"
                  href={waLink(r.customer.phone, `Assalam o Alaikum ${r.customer.name}! Kal (${shortDate(tomorrow)}) pani bhej dein? ${s.businessName}`)}>
                  <ChatIcon className="size-4" /> Ask
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function NewOrder({ today, tomorrow }: { today: string; tomorrow: string }) {
  const cs = await db.select({
    id: schema.customers.id, name: schema.customers.name, society: schema.customers.society, phone: schema.customers.phone,
    defaultStd: schema.customers.defaultStd, defaultDisp: schema.customers.defaultDisp,
  }).from(schema.customers).where(eq(schema.customers.active, true)).orderBy(asc(schema.customers.name));
  const inbox = !!(process.env.WA_APP_SECRET && process.env.WA_VERIFY_TOKEN);
  return (
    <div className="space-y-4">
      <PasteOrderForm customers={cs} today={today} />
      <ManualOrderForm customers={cs} tomorrow={tomorrow} />
      <div className={`rounded-xl p-3 text-sm ${inbox ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>
        {inbox
          ? "WhatsApp inbox is connected: messages to your business number become orders by themselves."
          : "Optional: connect the WhatsApp Business inbox so customers' messages become orders automatically, with no copy-paste (PokitBio sets this up)."}
      </div>
    </div>
  );
}
