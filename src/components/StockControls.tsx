"use client";

import { useActionState, useEffect, useState } from "react";
import { stockMove } from "@/app/actions";

type Kind = "in" | "out" | "count";
const LABEL: Record<Kind, string> = { in: "Stock in", out: "Stock out", count: "Set count" };
const HINT: Record<Kind, string> = {
  in: "Filled, bought or returned",
  out: "Used, damaged or given",
  count: "Your physical count; the difference is saved",
};

export default function StockControls({ itemId, unit, current }: { itemId: number; unit: string; current: number }) {
  const [open, setOpen] = useState<Kind | null>(null);
  const [state, action, pending] = useActionState(stockMove, undefined);
  useEffect(() => { if (state?.ok) setOpen(null); }, [state]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {(["in", "out", "count"] as Kind[]).map((k) => (
          <button key={k} type="button" onClick={() => setOpen(open === k ? null : k)}
            className={`h-10 rounded-xl border text-sm font-semibold ${open === k ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {k === "in" ? "+ In" : k === "out" ? "− Out" : "Count"}
          </button>
        ))}
      </div>
      {open && (
        <form key={open} action={action} className="space-y-2 rounded-xl bg-brand-tint p-3">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="kind" value={open} />
          <input type="hidden" name="current" value={current} />
          <p className="text-sm font-semibold">{LABEL[open]} <span className="font-normal text-slate-600">· {HINT[open]}</span></p>
          <div className="flex gap-2">
            <div className="w-28">
              <label htmlFor={`q-${itemId}`} className="sr-only">Quantity</label>
              <input id={`q-${itemId}`} name="qty" type="number" min={0} required inputMode="numeric" className="input"
                placeholder={unit} defaultValue={open === "count" ? current : ""} autoFocus />
            </div>
            <div className="flex-1">
              <label htmlFor={`n-${itemId}`} className="sr-only">Note</label>
              <input id={`n-${itemId}`} name="note" className="input" placeholder="Note (optional)" maxLength={120} />
            </div>
          </div>
          {state?.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : `Save ${LABEL[open].toLowerCase()}`}</button>
        </form>
      )}
      {state?.ok && !open && <p className="text-sm text-green-700" role="status">Saved.</p>}
    </div>
  );
}
