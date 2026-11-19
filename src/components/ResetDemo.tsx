"use client";

import { useActionState } from "react";
import { resetDemoAction } from "@/app/actions";

export default function ResetDemo() {
  const [state, action, pending] = useActionState(resetDemoAction, undefined);
  return (
    <form id="demo" action={action} className="card space-y-3 border-amber-200 p-4">
      <h2 className="font-semibold">Reset demo</h2>
      <p className="text-sm text-slate-600">
        Puts back the sample customers, deliveries and payments (dated up to yesterday) and the &quot;Demo Water Plant&quot; settings.
        Do this before showing the app to a new customer.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="confirm" required className="size-5" /> Yes, reset all demo data
      </label>
      {state?.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700" role="status">{state.ok}</p>}
      <button className="btn-outline w-full" disabled={pending}>{pending ? "Resetting…" : "Reset demo data"}</button>
    </form>
  );
}
