import Link from "next/link";
import NewItemForm from "@/components/NewItemForm";
import StockControls from "@/components/StockControls";
import { cansWithCustomers, itemsWithStock } from "@/lib/inventory";

export default async function InventoryPage() {
  const [items, outWithCustomers] = await Promise.all([itemsWithStock(), cansWithCustomers()]);
  const low = items.filter((i) => i.low);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Stock</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs text-slate-600">Low stock items</p>
          <p className={`text-xl font-bold ${low.length ? "text-red-700" : "text-green-700"}`}>{low.length ? low.length : "None"}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-600">Empty cans with customers</p>
          <p className="text-xl font-bold">{outWithCustomers}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/inventory/${it.id}`} className="font-semibold hover:underline">{it.name}</Link>
                {it.linkedTo && (
                  <p className="text-xs text-slate-600">
                    Goes down with every {it.linkedTo === "std" ? "standard" : "dispenser"} can delivered
                  </p>
                )}
                {it.low && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Low stock (at {it.lowAt})</span>}
              </div>
              <p className="shrink-0 text-right">
                <span className={`block text-2xl font-bold ${it.stock < 0 ? "text-red-700" : ""}`}>{it.stock.toLocaleString("en-US")}</span>
                <span className="text-xs text-slate-600">{it.unit}</span>
              </p>
            </div>
            <StockControls itemId={it.id} unit={it.unit} current={it.stock} />
          </li>
        ))}
        {items.length === 0 && <li className="card p-6 text-center text-slate-600">No stock items yet. Add one below.</li>}
      </ul>

      <NewItemForm />
    </div>
  );
}
