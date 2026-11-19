"use client";

import { useActionState, useState } from "react";
import { restoreAction } from "@/app/actions";

export type BackupItem = { id: number; title: string; sub: string; summary: string };

export default function RestoreList({ items }: { items: BackupItem[] }) {
  const [state, action, pending] = useActionState(restoreAction, undefined);
  const [picked, setPicked] = useState<number | null>(null);
  const chosen = items.find((i) => i.id === picked);

  return (
    <form action={action} className="space-y-3">
      {state?.ok && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{state.ok}</p>}
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</p>}

      <fieldset className="card divide-y divide-slate-100">
        <legend className="sr-only">Choose a backup</legend>
        {items.map((b) => (
          <label key={b.id} className={`flex cursor-pointer items-start gap-3 p-4 ${picked === b.id ? "bg-brand-tint" : ""}`}>
            <input type="radio" name="id" value={b.id} checked={picked === b.id} onChange={() => setPicked(b.id)} className="mt-1 size-5" />
            <span className="min-w-0">
              <span className="block font-semibold">{b.title}</span>
              <span className="block text-sm text-slate-600">{b.sub}</span>
              <span className="block text-xs text-slate-600">{b.summary}</span>
            </span>
          </label>
        ))}
        {items.length === 0 && <p className="p-4 text-sm text-slate-600">No backups yet. Today&apos;s copy is made automatically.</p>}
      </fieldset>

      {chosen && (
        <div className="card space-y-3 border-red-200 p-4">
          <p className="text-sm">
            All customers, deliveries, payments and bills will go back to: <b>{chosen.title}</b>.
            Anything entered after that will be removed from the app.
          </p>
          <p className="text-xs text-slate-600">A copy of the current data is saved first, so you can undo this.</p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="confirm" required className="size-5" /> Yes, go back to this backup
          </label>
          <button className="btn-danger w-full" disabled={pending}>{pending ? "Restoring…" : "Restore this backup"}</button>
        </div>
      )}
    </form>
  );
}
