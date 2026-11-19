import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import RouteList from "@/components/RouteList";
import { balances, getSettings, pricesFor, societies } from "@/lib/data";
import { isValidDate, pkToday, shortDate } from "@/lib/dates";
import { rs } from "@/lib/format";

export default async function RoutePage({ searchParams }: { searchParams: Promise<{ s?: string; date?: string }> }) {
  const sp = await searchParams;
  const today = pkToday();
  const date = sp.date && isValidDate(sp.date) ? sp.date : today;
  const allSocieties = await societies();
  const society = sp.s && allSocieties.includes(sp.s) ? sp.s : allSocieties[0];

  const s = await getSettings();
  const [list, dayDeliveries, allActive, bal] = await Promise.all([
    db.select().from(schema.customers)
      .where(and(eq(schema.customers.active, true), eq(schema.customers.society, society)))
      .orderBy(asc(schema.customers.address), asc(schema.customers.name)),
    db.select().from(schema.deliveries).where(eq(schema.deliveries.date, date)),
    db.select({ id: schema.customers.id, society: schema.customers.society })
      .from(schema.customers).where(eq(schema.customers.active, true)),
    balances(),
  ]);
  const byCustomer = new Map(dayDeliveries.map((d) => [d.customerId, d]));
  const cans = dayDeliveries.reduce((n, d) => n + d.std + d.disp, 0);
  const amount = dayDeliveries.reduce((n, d) => n + d.amount, 0);
  const counts = new Map<string, number>();
  for (const c of allActive) counts.set(c.society, (counts.get(c.society) ?? 0) + 1);

  const rows = list.map((c) => {
    const d = byCustomer.get(c.id);
    const p = pricesFor(c, s);
    return {
      id: c.id, name: c.name, address: c.address, phone: c.phone,
      priceStd: p.std, priceDisp: p.disp,
      std: d?.std ?? c.defaultStd, disp: d?.disp ?? c.defaultDisp,
      delivered: !!d,
      startingCans: c.startingCans,
      balance: bal.get(c.id) ?? 0,
    };
  });
  const qs = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ ...(date !== today ? { date } : {}), ...extra }).toString();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-brand p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-brand-light">{date === today ? "Today" : "Back entry"} · {shortDate(date)}</p>
            <h1 className="text-2xl font-bold">Route</h1>
          </div>
          <form className="flex items-center gap-2">
            {society && <input type="hidden" name="s" value={society} />}
            <label htmlFor="date" className="sr-only">Date</label>
            <input id="date" type="date" name="date" defaultValue={date} max={today}
              className="h-11 rounded-xl bg-white px-2 text-sm text-slate-900" />
            <button className="h-11 rounded-xl bg-brand-dark px-3 text-sm font-semibold">Go</button>
          </form>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Homes" value={`${dayDeliveries.length}/${allActive.length}`} />
          <Stat label="Cans" value={String(cans)} />
          <Stat label="Sales" value={rs(amount)} />
        </div>
      </section>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {allSocieties.map((name) => (
          <Link key={name} href={qs({ s: name })}
            className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${name === society ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {name} · {counts.get(name) ?? 0}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-slate-600">No customers here yet.</p>
          <Link href="/customers/new" className="btn-primary mt-3">Add customer</Link>
        </div>
      ) : (
        <RouteList key={`${date}-${society}`} rows={rows} date={date} business={s.businessName} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-dark px-3 py-2">
      <p className="text-xs text-brand-light">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
