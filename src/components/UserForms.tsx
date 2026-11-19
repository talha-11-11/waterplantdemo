"use client";

import { useActionState } from "react";
import { changeOwnPassword, createUser, resetUserPassword } from "@/app/actions";

function Msg({ state }: { state?: { error?: string; ok?: boolean } }) {
  if (state?.error) return <p className="text-sm text-red-700" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-700" role="status">Done.</p>;
  return null;
}

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold">Add login</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nu-username" className="label">Username</label>
          <input id="nu-username" name="username" required className="input" autoCapitalize="none" />
        </div>
        <div>
          <label htmlFor="nu-name" className="label">Name</label>
          <input id="nu-name" name="name" className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nu-role" className="label">Role</label>
          <select id="nu-role" name="role" className="input" defaultValue="admin">
            <option value="admin">Admin (business)</option>
            <option value="superadmin">Super admin (PokitBio)</option>
          </select>
        </div>
        <div>
          <label htmlFor="nu-password" className="label">Password</label>
          <input id="nu-password" name="password" type="text" required minLength={6} className="input" autoComplete="new-password" />
        </div>
      </div>
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending}>Add login</button>
    </form>
  );
}

export function ResetPasswordForm({ id, username }: { id: number; username: string }) {
  const [state, action, pending] = useActionState(resetUserPassword, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`rp-${id}`} className="label">New password for {username}</label>
        <input id={`rp-${id}`} name="password" type="text" required minLength={6} className="input" autoComplete="new-password" />
      </div>
      <button className="btn-outline" disabled={pending}>Reset</button>
      <div className="w-full"><Msg state={state} /></div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold">Change my password</h2>
      <div>
        <label htmlFor="cp-current" className="label">Current password</label>
        <input id="cp-current" name="current" type="password" required className="input" autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="cp-new" className="label">New password (at least 6 characters)</label>
        <input id="cp-new" name="password" type="password" required minLength={6} className="input" autoComplete="new-password" />
      </div>
      <Msg state={state} />
      <button className="btn-outline w-full" disabled={pending}>Change password</button>
    </form>
  );
}
