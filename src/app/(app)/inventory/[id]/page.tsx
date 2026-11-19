import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteItem } from "@/app/actions";
import { BackIcon } from "@/components/icons";
import { shortDate } from "@/lib/dates";
import { deliveriesByDay, itemHistory, itemsWithStock } from "@/lib/inventory";

const KIND: Record<string, string> = { in: "In", out: "Out", count: "Count" };

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const it = (await itemsWithStock(true)).find((i) => i.id === id);
  if (!it) notFound();
  const [moves, delivered] = await Promise.all([itemHistory(id), deliveriesByDay(it.linkedTo, it.trackFrom)]);

  return (
    <div className="space-y-4">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><BackIcon /> Stock</Link>
      <section className="card p-4">
        <h1 className="text-2xl font-bold">{it.name}</h1>
        <p className="text-3xl font-bold">{it.stock.toLocaleString("en-US")} <span className="text-base font-medium text-slate-600">{it.unit}</span></p>
        <p className="text-sm text-slate-600">Low-stock alert at {it.lowAt} {it.unit}{it.linkedTo ? ` · ${it.delivered} delivered since ${shortDate(it.trackFrom)}` : ""}</p>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Stock history</h2>
        {moves.length === 0 ? <p className="text-sm text-slate-600">No entries yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {shortDate(m.date)} · {KIND[m.kind] ?? m.kind}{m.note ? ` · ${m.note}` : ""}
                  {m.createdBy && <span className="text-xs text-slate-600"> ({m.createdBy})</span>}
                </span>
                <span className={`font-semibold ${m.qty < 0 ? "text-red-700" : "text-green-700"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {delivered.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Delivered (taken off automatically)</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {delivered.map((d) => (
              <li key={d.date} className="flex justify-between py-2">
                <span>{shortDate(d.date)}</span><span className="font-semibold text-red-700">−{Number(d.n)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={deleteItem} className="card space-y-3 p-4">
        <input type="hidden" name="id" value={it.id} />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" required className="size-5" /> Yes, delete this item and its history
        </label>
        <button className="btn-danger w-full">Delete item</button>
      </form>
    </div>
  );
}
