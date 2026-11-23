"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addPayment, deleteDelivery, saveDelivery } from "@/app/actions";
import { deliveryMessage, waLink } from "@/lib/messages";
import { ChatIcon, CheckIcon, PlusIcon } from "./icons";

type Row = {
  id: number; name: string; address: string; phone: string;
  priceStd: number; priceDisp: number; std: number; disp: number; delivered: boolean;
  startingCans: number; balance: number;
};

const rs = (n: number) => `Rs ${n.toLocaleString("en-US")}`;

export default function RouteList({ rows, date, business }: { rows: Row[]; date: string; business: string }) {
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const shown = rows.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(q.toLowerCase()));

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <>
      {rows.length > 5 && (
        <div>
          <label htmlFor="route-search" className="sr-only">Search customers</label>
          <input id="route-search" className="input" placeholder="Search name or house…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      <ul className="space-y-3">
        {shown.map((r) => <RouteRow key={r.id} row={r} date={date} business={business} onDone={flash} />)}
      </ul>
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

function RouteRow({ row, date, business, onDone }: { row: Row; date: string; business: string; onDone: (m: string) => void }) {
  const [std, setStd] = useState(row.std);
  const [disp, setDisp] = useState(row.disp);
  // Dispenser cans stay hidden unless this customer usually takes them or the owner adds them now
  const [showDisp, setShowDisp] = useState(row.disp > 0);
  const [editing, setEditing] = useState(!row.delivered);
  const [cashOpen, setCashOpen] = useState(false);
  const [pending, start] = useTransition();
  const amount = std * row.priceStd + disp * row.priceDisp;
  const delivered = row.delivered && !editing;

  const message = deliveryMessage({ date, std, disp, business });
  // Open WhatsApp inside the tap itself (browsers block it after an await), then save.
  const openWhatsApp = () => window.open(waLink(row.phone, message), "_blank", "noopener");

  const save = () => {
    openWhatsApp();
    start(async () => {
      try {
        await saveDelivery({ customerId: row.id, date, std, disp });
        setEditing(false);
        onDone(`Saved: ${row.name} · ${rs(amount)}`);
      } catch {
        onDone("Not saved. Check internet and tap Deliver again.");
      }
    });
  };
  const undo = () =>
    start(async () => {
      await deleteDelivery(row.id, date);
      setEditing(true);
      onDone(`Removed delivery for ${row.name}`);
    });

  return (
    <li className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/customers/${row.id}`} className="block truncate text-base font-semibold text-slate-900 hover:underline">{row.name}</Link>
          <p className="truncate text-sm text-slate-600">{row.address || "—"}</p>
          <p className="text-xs text-slate-600">
            {row.startingCans > 0 && <>{row.startingCans} {row.startingCans === 1 ? "can" : "cans"} with customer · </>}
            {row.balance > 0 ? <span className="font-semibold text-red-700">Owes {rs(row.balance)}</span> : <span className="text-green-700">Clear</span>}
          </p>
        </div>
        {row.delivered && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
            <CheckIcon /> Delivered
          </span>
        )}
      </div>

      {delivered ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
          <span>
            {disp ? `${std} standard + ${disp} dispenser` : `${std} cans`} · <b>{rs(amount)}</b>
          </span>
          <div className="flex gap-2">
            <button className="btn-outline h-9 px-3" onClick={openWhatsApp} aria-label={`Send WhatsApp to ${row.name} again`}><ChatIcon className="size-4" /></button>
            <button className="btn-outline h-9 px-3" onClick={() => setCashOpen((v) => !v)}>Cash</button>
            <button className="btn-outline h-9 px-3" onClick={() => setEditing(true)} disabled={pending}>Edit</button>
            <button className="btn-outline h-9 px-3" onClick={undo} disabled={pending}>Undo</button>
          </div>
        </div>
      ) : (
        <>
          <Stepper label={showDisp ? "Standard can" : "Cans"} price={row.priceStd} value={std} onChange={setStd} />
          {showDisp ? (
            <Stepper label="Dispenser can" price={row.priceDisp} value={disp} onChange={(n) => { setDisp(n); }} />
          ) : (
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-tint"
              onClick={() => { setShowDisp(true); setDisp(1); }}>
              <PlusIcon /> Add dispenser can
            </button>
          )}
          <button className="btn-primary w-full" onClick={save} disabled={pending || std + disp === 0}>
            {pending ? "Saving…" : <><ChatIcon className="size-4" /> Deliver &amp; WhatsApp · {rs(amount)}</>}
          </button>
        </>
      )}

      {cashOpen && delivered && (
        <CashForm customerId={row.id} date={date} std={std} disp={disp} priceStd={row.priceStd} priceDisp={row.priceDisp}
          onSaved={(amt) => { setCashOpen(false); onDone(`Cash received: ${rs(amt)} from ${row.name}`); }} />
      )}
    </li>
  );
}

function Stepper({ label, price, value, onChange }: { label: string; price: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-slate-600">{rs(price)} each</p>
      </div>
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-300">
        <button type="button" aria-label={`One less ${label}`} className="size-11 bg-slate-50 text-xl" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <span className="w-10 text-center text-lg font-bold" aria-live="polite">{value}</span>
        <button type="button" aria-label={`One more ${label}`} className="size-11 bg-slate-50 text-xl" onClick={() => onChange(Math.min(50, value + 1))}>+</button>
      </div>
    </div>
  );
}

/** Cash at the door. Quick buttons for paying for only some of the cans. */
function CashForm({ customerId, date, std, disp, priceStd, priceDisp, onSaved }: {
  customerId: number; date: string; std: number; disp: number; priceStd: number; priceDisp: number; onSaved: (amt: number) => void;
}) {
  const full = std * priceStd + disp * priceDisp;
  const [amt, setAmt] = useState(String(full));
  const [pending, start] = useTransition();
  const chips: { label: string; value: number }[] = [];
  for (let k = 1; k < std; k++) chips.push({ label: `${k} can${k > 1 ? "s" : ""}`, value: k * priceStd });
  chips.push({ label: "All", value: full });

  return (
    <div className="space-y-2 rounded-xl bg-brand-tint p-3">
      <p className="text-sm font-semibold">Customer paid for</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={() => setAmt(String(c.value))}
            className={`h-9 rounded-lg border px-3 text-sm font-semibold ${Number(amt) === c.value ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {c.label} · {rs(c.value)}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`cash-${customerId}`} className="label">Amount received (Rs)</label>
          <input id={`cash-${customerId}`} className="input" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} />
        </div>
        <button className="btn-primary" disabled={pending || !Number(amt)}
          onClick={() => start(async () => {
            await addPayment({ customerId, amount: Number(amt), method: "cash", date });
            onSaved(Number(amt));
          })}>
          Save
        </button>
      </div>
      <p className="text-xs text-slate-600">The rest stays as the customer&apos;s balance and shows on the bill.</p>
    </div>
  );
}
