"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions";
import type { Settings } from "@/db/schema";

function Field({ label, name, defaultValue, ...rest }: { label: string; name: string; defaultValue?: string | number } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} defaultValue={defaultValue} className="input" {...rest} />
    </div>
  );
}

export default function SettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="card space-y-4 p-4">
      <h2 className="font-semibold">Business</h2>
      <Field label="Business name" name="businessName" defaultValue={s.businessName} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Standard can (Rs)" name="priceStd" type="number" min={0} defaultValue={s.priceStd} required />
        <Field label="Dispenser can (Rs)" name="priceDisp" type="number" min={0} defaultValue={s.priceDisp} required />
      </div>
      <p className="text-xs text-slate-600">New prices apply to new deliveries only. Old deliveries keep the price they were saved with.</p>
      <Field label="Your phone (on bills)" name="ownerPhone" defaultValue={s.ownerPhone ? `0${s.ownerPhone.slice(2)}` : ""} placeholder="0300-1234567" />

      <h2 className="pt-2 font-semibold">Payment accounts (on bills)</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="JazzCash number" name="jazzcashNumber" defaultValue={s.jazzcashNumber} placeholder="0300-1234567" inputMode="tel" />
        <Field label="JazzCash account name" name="jazzcashTitle" defaultValue={s.jazzcashTitle} placeholder="Account holder name" />
      </div>
      <details className="rounded-xl bg-slate-50 p-3" open={!!(s.easypaisaNumber || s.paymentInfo)}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Other accounts (optional)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Easypaisa number" name="easypaisaNumber" defaultValue={s.easypaisaNumber} placeholder="Leave empty if none" inputMode="tel" />
            <Field label="Easypaisa account name" name="easypaisaTitle" defaultValue={s.easypaisaTitle} />
          </div>
          <Field label="Other payment note" name="paymentInfo" defaultValue={s.paymentInfo} placeholder="e.g. Bank: Meezan 0123…" />
        </div>
      </details>
      <p className="text-xs text-slate-600">Only accounts with a number show on bills. Empty = hidden.</p>

      <h2 className="pt-2 font-semibold">Optional features</h2>
      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <input type="checkbox" name="cameraProduction" defaultChecked={s.cameraProduction} className="mt-0.5 size-5" />
        <span>
          <b>Camera production count (RO plants)</b>
          <span className="block text-xs text-slate-600">Take a photo of filled bottles and the phone counts them, then adds them to stock. Shows on the Stock page when on.</span>
        </span>
      </label>

      {state?.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700" role="status">Saved.</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
