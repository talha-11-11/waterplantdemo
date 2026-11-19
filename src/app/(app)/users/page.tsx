import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { setUserActive } from "@/app/actions";
import { BackIcon } from "@/components/icons";
import { NewUserForm, ResetPasswordForm } from "@/components/UserForms";
import { pageUser } from "@/lib/session";

// Super admin (PokitBio) only
export default async function UsersPage() {
  const me = await pageUser("superadmin");
  const list = await db.select().from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.username));

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><BackIcon /> Settings</Link>
      <h1 className="text-2xl font-bold">Logins</h1>
      <p className="text-sm text-slate-600">
        <b>Super admin</b> (PokitBio): everything, plus managing logins. <b>Admin</b> (business owner): deliveries, customers, payments, bills and settings.
      </p>

      <ul className="space-y-3">
        {list.map((u) => (
          <li key={u.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{u.name || u.username} {u.id === me.id && <span className="text-xs text-slate-600">(you)</span>}</p>
                <p className="text-sm text-slate-600">@{u.username} · {u.role === "superadmin" ? "Super admin" : "Admin"}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>
                {u.active ? "Active" : "Blocked"}
              </span>
            </div>
            <ResetPasswordForm id={u.id} username={u.username} />
            {u.id !== me.id && (
              <form action={setUserActive}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                <button className={u.active ? "btn-danger w-full" : "btn-outline w-full"}>
                  {u.active ? "Block this login" : "Unblock this login"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <NewUserForm />
    </div>
  );
}
