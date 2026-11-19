import Link from "next/link";
import { desc, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import CameraCounter from "@/components/CameraCounter";
import { BackIcon } from "@/components/icons";
import { getSettings } from "@/lib/data";
import { addDays, pkToday, shortDate, TZ } from "@/lib/dates";
import { itemsWithStock } from "@/lib/inventory";

const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(d);

// Optional feature (Settings → Optional features → Camera production count)
export default async function ProductionPage() {
  const s = await getSettings();
  if (!s.cameraProduction) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Production</h1>
        <div className="card space-y-3 p-4">
          <p className="text-sm text-slate-700">Camera production counting is an optional feature for RO plants. It&apos;s switched off.</p>
          <Link href="/settings" className="btn-outline w-full">Turn it on in Settings</Link>
        </div>
      </div>
    );
  }
  const today = pkToday();
  const [items, logs, week] = await Promise.all([
    itemsWithStock(),
    db.select().from(schema.productionLogs).where(gte(schema.productionLogs.date, today)).orderBy(desc(schema.productionLogs.id)),
    db.select({ date: schema.productionLogs.date, n: sql<string>`sum(${schema.productionLogs.count})` }).from(schema.productionLogs)
      .where(gte(schema.productionLogs.date, addDays(today, -6))).groupBy(schema.productionLogs.date).orderBy(desc(schema.productionLogs.date)),
  ]);
  const todayTotal = logs.reduce((n, l) => n + l.count, 0);
  const defaultItem = items.find((i) => i.linkedTo === "std") ?? items[0];

  return (
    <div className="space-y-4">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><BackIcon /> Stock</Link>
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Production</h1>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Optional feature</span>
      </div>

      <section className="rounded-2xl bg-brand p-4 text-white">
        <p className="text-sm text-brand-light">Made today · {shortDate(today)}</p>
        <p className="text-4xl font-bold">{todayTotal.toLocaleString("en-US")} <span className="text-base font-medium">bottles</span></p>
      </section>

      <CameraCounter items={items.map((i) => ({ id: i.id, name: i.name }))} defaultItemId={defaultItem?.id ?? null} />

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Today&apos;s entries</h2>
        {logs.length === 0 ? <p className="text-sm text-slate-600">Nothing recorded yet today.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-2">
                <span>{time(l.createdAt)} · {l.method === "camera" ? `Camera${l.detected != null && l.detected !== l.count ? ` (counted ${l.detected}, fixed)` : ""}` : "Typed"}{l.createdBy ? ` · ${l.createdBy}` : ""}</span>
                <b>+{l.count}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      {week.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Last 7 days</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {week.map((w) => <li key={w.date} className="flex justify-between py-2"><span>{shortDate(w.date)}</span><b>{Number(w.n).toLocaleString("en-US")}</b></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
