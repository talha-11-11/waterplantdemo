"use client";

import { useActionState } from "react";
import type { RunResult } from "@/lib/notify";

type Action = (prev: unknown, form: FormData) => Promise<RunResult | { error: string }>;

/** Form button that runs a WhatsApp send action and shows the result. */
export default function RunButton({ action, label, fields, confirmText }: {
  action: Action; label: string; fields: Record<string, string>; confirmText?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-2">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirmText && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" required className="size-5" /> {confirmText}
        </label>
      )}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : label}</button>
      {state && "error" in state && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state && "mode" in state && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm" role="status">
          {state.mode === "dry_run" && <p className="mb-1 font-semibold text-amber-800">Test mode — nothing was sent, messages were only logged.</p>}
          <p>Sent: {state.sent} · Test-logged: {state.dryRun} · Failed: {state.failed} · Skipped: {state.skipped}</p>
          {state.errors.slice(0, 5).map((e) => <p key={e} className="text-red-700">{e}</p>)}
        </div>
      )}
    </form>
  );
}
