import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { PlusIcon } from "@/components/icons";
import { balances } from "@/lib/data";
import { displayPhone, rs } from "@/lib/format";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [all, bal] = await Promise.all([
    db.select().from(schema.customers).orderBy(asc(schema.customers.society), asc(schema.customers.name)),
    balances(),
  ]);
  const needle = q.trim().toLowerCase();
  const list = needle
    ? all.filter((c) => `${c.name} ${c.address} ${c.society} ${c.phone}`.toLowerCase().includes(needle))
    : all;
  const groups = new Map<string, typeof list>();
  for (const c of list) groups.set(c.society, [...(groups.get(c.society) ?? []), c]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers <span className="text-base font-medium text-slate-600">({all.length})</span></h1>
        <Link href="/customers/new" className="btn-primary"><PlusIcon /> Add</Link>
      </div>
      <form>
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="Search name, house, phone…" />
      </form>
      {[...groups.entries()].map(([society, cs]) => (
        <section key={society} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{society}</h2>
          <ul className="card divide-y divide-slate-100">
            {cs.map((c) => {
              const b = bal.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}{!c.active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">inactive</span>}</p>
                      <p className="truncate text-sm text-slate-600">{c.address || "—"} · {displayPhone(c.phone)}{c.startingCans ? ` · ${c.startingCans} cans` : ""}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${b > 0 ? "text-red-700" : "text-green-700"}`}>
                      {b > 0 ? rs(b) : b < 0 ? `+${rs(-b)}` : "Clear"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {list.length === 0 && <p className="card p-6 text-center text-slate-600">No customers found.</p>}
    </div>
  );
}
