"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createManualOrder, createPastedOrder } from "@/app/actions";
import { parseOrderText } from "@/lib/orderParse";
import { normalizePhone } from "@/lib/format";

type C = { id: number; name: string; society: string; phone: string; defaultStd: number; defaultDisp: number };

function Msg({ state }: { state?: { error?: string; ok?: boolean } }) {
  if (state?.error) return <p className="text-sm text-red-700" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-700" role="status">Order saved.</p>;
  return null;
}

/** Paste a customer's WhatsApp message: the app reads cans + date and finds the customer. */
export function PasteOrderForm({ customers, today }: { customers: C[]; today: string }) {
  const [state, action, pending] = useActionState(createPastedOrder, undefined);
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const parsed = useMemo(() => parseOrderText(text, today), [text, today]);
  const matched = useMemo(() => {
    if (!text) return null;
    const p = parsed.phone ? normalizePhone(parsed.phone) : null;
    const byPhone = p ? customers.find((c) => c.phone === p) : undefined;
    if (byPhone) return byPhone;
    const t = text.toLowerCase();
    const byName = customers.filter((c) => t.includes(c.name.toLowerCase()));
    return byName.length === 1 ? byName[0] : null;
  }, [text, parsed, customers]);
  const [customerId, setCustomerId] = useState<string>("");
  const chosen = customers.find((c) => String(c.id) === (customerId || String(matched?.id ?? "")));
  const std = parsed.foundQty ? parsed.std : chosen?.defaultStd ?? 1;
  const disp = parsed.foundQty ? parsed.disp : chosen?.defaultDisp ?? 0;

  useEffect(() => {
    if (state?.ok) { setText(""); setCustomerId(""); formRef.current?.reset(); }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold">Paste a WhatsApp message</h2>
      <p className="text-xs text-slate-600">Long-press the customer&apos;s message in WhatsApp → Copy → paste here. Works with Roman Urdu or English, e.g. &quot;kal 3 can aur 1 dispenser&quot;.</p>
      <label htmlFor="paste-text" className="sr-only">Message</label>
      <textarea id="paste-text" name="text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className="input h-auto py-2"
        placeholder="Assalam o alaikum, kal 3 can bhej dein" />
      {text && (
        <div className="space-y-3 rounded-xl bg-brand-tint p-3">
          <p className="text-sm font-semibold">The app read:</p>
          <div>
            <label htmlFor="paste-c" className="label">Customer {matched && !customerId && <span className="text-green-700">(found)</span>}</label>
            <select id="paste-c" name="customerId" className="input" value={customerId || String(matched?.id ?? "")} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Not in list (keep message only)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.society}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="paste-std" className="label">Standard</label>
              <input key={`s${std}`} id="paste-std" name="std" type="number" min={0} defaultValue={std} className="input" />
            </div>
            <div>
              <label htmlFor="paste-disp" className="label">Dispenser</label>
              <input key={`d${disp}`} id="paste-disp" name="disp" type="number" min={0} defaultValue={disp} className="input" />
            </div>
            <div>
              <label htmlFor="paste-date" className="label">Date</label>
              <input key={parsed.date} id="paste-date" name="date" type="date" defaultValue={parsed.date} min={today} className="input px-2 text-sm" />
            </div>
          </div>
          {!parsed.foundQty && <p className="text-xs text-amber-800">No number in the message, so the customer&apos;s usual cans are used.</p>}
        </div>
      )}
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending || !text}>{pending ? "Saving…" : "Save order"}</button>
    </form>
  );
}

export function ManualOrderForm({ customers, tomorrow }: { customers: C[]; tomorrow: string }) {
  const [state, action, pending] = useActionState(createManualOrder, undefined);
  const [cid, setCid] = useState("");
  const c = customers.find((x) => String(x.id) === cid);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { formRef.current?.reset(); setCid(""); } }, [state]);
  return (
    <form ref={formRef} action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold">Add order by hand</h2>
      <div>
        <label htmlFor="mo-c" className="label">Customer</label>
        <select id="mo-c" name="customerId" required className="input" value={cid} onChange={(e) => setCid(e.target.value)}>
          <option value="" disabled>Choose customer…</option>
          {customers.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.society}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="mo-std" className="label">Standard</label>
          <input key={`s${cid}`} id="mo-std" name="std" type="number" min={0} defaultValue={c?.defaultStd ?? 1} className="input" />
        </div>
        <div>
          <label htmlFor="mo-disp" className="label">Dispenser</label>
          <input key={`d${cid}`} id="mo-disp" name="disp" type="number" min={0} defaultValue={c?.defaultDisp ?? 0} className="input" />
        </div>
        <div>
          <label htmlFor="mo-date" className="label">Date</label>
          <input id="mo-date" name="date" type="date" defaultValue={tomorrow} className="input px-2 text-sm" />
        </div>
      </div>
      <div>
        <label htmlFor="mo-note" className="label">Note</label>
        <input id="mo-note" name="note" className="input" placeholder="e.g. phone call, deliver after 5 pm" />
      </div>
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save order"}</button>
    </form>
  );
}
