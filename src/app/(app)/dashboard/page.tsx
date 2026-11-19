import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { balances, monthStats } from "@/lib/data";
import { itemsWithStock } from "@/lib/inventory";
import { isValidMonth, monthLabel, monthOf, pkToday, prevMonth } from "@/lib/dates";
import { cansText, rs } from "@/lib/format";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const current = monthOf(pkToday());
  const month = m && isValidMonth(m) ? m : current;
  const lowStock = (await itemsWithStock()).filter((i) => i.low);
  const [stats, bal, cs, logs] = await Promise.all([
    monthStats(month),
    balances(),
    db.select().from(schema.customers),
    db.select({ l: schema.messageLog, name: schema.customers.name })
      .from(schema.messageLog)
      .leftJoin(schema.customers, eq(schema.customers.id, schema.messageLog.customerId))
      .orderBy(desc(schema.messageLog.id)).limit(8),
  ]);
  const dues = cs
    .map((c) => ({ c, b: bal.get(c.id) ?? 0 }))
    .filter((x) => x.b > 0)
    .sort((a, b) => b.b - a.b);
  const totalDue = dues.reduce((n, x) => n + x.b, 0);
  const maxSoc = Math.max(1, ...stats.bySociety.map((s) => s.amount));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/payments" className="text-sm font-semibold text-brand underline underline-offset-4">Payments</Link>
        </span>
        <div className="flex gap-2">
          {[current, prevMonth(current)].map((mm) => (
            <Link key={mm} href={`/dashboard?m=${mm}`}
              className={`flex h-10 items-center rounded-full border px-3 text-sm font-semibold ${mm === month ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {monthLabel(mm).split(" ")[0].slice(0, 3)}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label={`Sales · ${monthLabel(month)}`} value={rs(stats.amount)} sub={cansText(stats.std, stats.disp)} />
        <Tile label="Collected this month" value={rs(stats.collected)} />
        <Tile label="Total unpaid (all time)" value={rs(totalDue)} tone="red" sub={`${dues.length} customers`} />
        <Tile label="Active customers" value={String(cs.filter((c) => c.active).length)} />
      </div>

      {lowStock.length > 0 && (
        <Link href="/inventory" className="card block border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Low stock: {lowStock.length} item{lowStock.length > 1 ? "s" : ""}</p>
          <p className="text-sm text-red-800">{lowStock.map((i) => `${i.name} (${i.stock} ${i.unit})`).join(" · ")}</p>
        </Link>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Sales by society</h2>
        {stats.bySociety.length === 0 && <p className="text-sm text-slate-600">No deliveries this month yet.</p>}
        {stats.bySociety.map((s) => (
          <div key={s.society} className="space-y-1">
            <div className="flex justify-between text-sm"><span>{s.society}</span><span className="font-semibold">{rs(s.amount)}</span></div>
            <div className="h-2.5 rounded-full bg-slate-200">
              <div className="h-2.5 rounded-full bg-brand" style={{ width: `${(s.amount / maxSoc) * 100}%` }} />
            </div>
            <p className="text-xs text-slate-600">{cansText(s.std, s.disp)}</p>
          </div>
        ))}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Who owes money</h2>
        {dues.length === 0 ? <p className="text-sm text-slate-600">Nobody — all clear.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {dues.slice(0, 15).map(({ c, b }) => (
              <li key={c.id}>
                <Link href={`/customers/${c.id}`} className="flex justify-between py-2 hover:bg-slate-50">
                  <span><span className="font-medium">{c.name}</span> <span className="text-slate-600">· {c.society}</span></span>
                  <span className="font-semibold text-red-700">{rs(b)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">WhatsApp API log</h2>
        {logs.length === 0 ? <p className="text-sm text-slate-600">No automatic messages. Updates are sent from your own WhatsApp when you tap Deliver.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map(({ l, name }) => (
              <li key={l.id} className="py-2">
                <p><span className="font-medium">{name ?? "—"}</span> · {l.kind} · <StatusBadge s={l.status} /></p>
                <p className="line-clamp-2 text-xs text-slate-600">{l.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "red" }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className={`text-xl font-bold ${tone === "red" ? "text-red-700" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600">{sub}</p>}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls = s === "sent" ? "bg-green-100 text-green-800" : s === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{s === "dry_run" ? "test" : s}</span>;
}
