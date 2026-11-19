import Link from "next/link";
import { backupNowAction } from "@/app/actions";
import { BackIcon } from "@/components/icons";
import RestoreList, { type BackupItem } from "@/components/RestoreList";
import { listBackups } from "@/lib/backup";
import { addDays, shortDate, TZ } from "@/lib/dates";
import { pageUser } from "@/lib/session";

const time = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);

export default async function BackupsPage() {
  await pageUser();
  const list = await listBackups();
  const items: BackupItem[] = list.map((b) => {
    if (b.kind === "daily") {
      return {
        id: b.id,
        title: `Start of ${shortDate(b.label)}`,
        sub: `Everything up to the end of ${shortDate(addDays(b.label, -1))}`,
        summary: b.summary,
      };
    }
    return {
      id: b.id,
      title: b.kind === "manual" ? `Saved by hand · ${time(b.createdAt)}` : `Before a restore · ${time(b.createdAt)}`,
      sub: b.kind === "manual" ? `By ${b.createdBy}` : "Use this to undo a restore",
      summary: b.summary,
    };
  });

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><BackIcon /> Settings</Link>
      <h1 className="text-2xl font-bold">Backups</h1>
      <p className="text-sm text-slate-600">
        Every day, the first time the app is opened, it saves a copy of all data. If wrong data was entered or something
        got lost, choose a day below and restore it, then start again from there. Logins are not changed.
      </p>
      <form action={backupNowAction}>
        <button className="btn-outline w-full">Save a backup now</button>
      </form>
      <RestoreList items={items} />
    </div>
  );
}
