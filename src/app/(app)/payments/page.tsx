import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { addPaymentForm, deletePayment } from "@/app/actions";
import { pkToday, shortDate } from "@/lib/dates";
import { rs } from "@/lib/format";

export default async function PaymentsPage() {
  const [cs, recent] = await Promise.all([
    db.select({ id: schema.customers.id, name: schema.customers.name, society: schema.customers.society })
      .from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select({ p: schema.payments, name: schema.customers.name })
      .from(schema.payments)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.payments.customerId))
      .orderBy(desc(schema.payments.date), desc(schema.payments.id))
      .limit(50),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>
      <form action={addPaymentForm} className="card space-y-3 p-4">
        <input type="hidden" name="redirect" value="/payments" />
        <div>
          <label htmlFor="customerId" className="label">Customer</label>
          <select id="customerId" name="customerId" required className="input" defaultValue="">
            <option value="" disabled>Choose customer…</option>
            {cs.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.society}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="amount" className="label">Amount (Rs)</label>
            <input id="amount" name="amount" type="number" min={1} required className="input" />
          </div>
          <div>
            <label htmlFor="method" className="label">Method</label>
            <select id="method" name="method" className="input">
              <option value="cash">Cash</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="bank">Bank</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="label">Date</label>
            <input id="date" name="date" type="date" defaultValue={pkToday()} max={pkToday()} className="input" />
          </div>
          <div>
            <label htmlFor="note" className="label">Note</label>
            <input id="note" name="note" className="input" placeholder="Optional" />
          </div>
        </div>
        <button className="btn-primary w-full">Save payment</button>
      </form>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Recent payments</h2>
        {recent.length === 0 ? <p className="text-sm text-slate-600">No payments yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map(({ p, name }) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-xs text-slate-600">{shortDate(p.date)} · {p.method}{p.note ? ` · ${p.note}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-700">{rs(p.amount)}</span>
                  <form action={deletePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="h-9 rounded-lg px-2 text-xs font-semibold text-red-700 hover:bg-red-50" aria-label={`Delete payment from ${name}`}>Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
