import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { pkToday } from "./dates";

const { backups, customers, deliveries, payments, bills, settings } = schema;

const KEEP_DAILY = 45; // automatic daily copies kept
const KEEP_OTHER = 20; // manual + before-restore copies kept

type Snapshot = {
  v: 1;
  takenAt: string;
  settings: (typeof settings.$inferSelect)[];
  customers: (typeof customers.$inferSelect)[];
  deliveries: (typeof deliveries.$inferSelect)[];
  payments: (typeof payments.$inferSelect)[];
  bills: (typeof bills.$inferSelect)[];
};

async function takeSnapshot(): Promise<Snapshot> {
  const [s, c, d, p, b] = await Promise.all([
    db.select().from(settings), db.select().from(customers), db.select().from(deliveries),
    db.select().from(payments), db.select().from(bills),
  ]);
  return { v: 1, takenAt: new Date().toISOString(), settings: s, customers: c, deliveries: d, payments: p, bills: b };
}

const summarize = (x: Snapshot) =>
  `${x.customers.length} customers · ${x.deliveries.length} deliveries · ${x.payments.length} payments`;

export async function createBackup(kind: "daily" | "manual" | "before_restore", by = "", label?: string) {
  const snap = await takeSnapshot();
  const data = gzipSync(Buffer.from(JSON.stringify(snap))).toString("base64");
  const rows = await db.insert(backups)
    .values({ kind, label: label ?? new Date().toISOString(), summary: summarize(snap), data, createdBy: by })
    .onConflictDoNothing()
    .returning({ id: backups.id });
  await prune();
  return rows[0]?.id ?? null;
}

/** Called on every page load: makes today's start-of-day copy if it doesn't exist yet. */
export async function ensureDailyBackup() {
  const today = pkToday();
  const [have] = await db.select({ id: backups.id }).from(backups)
    .where(and(eq(backups.kind, "daily"), eq(backups.label, today)));
  if (!have) await createBackup("daily", "auto", today);
}

async function prune() {
  for (const [kinds, keep] of [[["daily"], KEEP_DAILY], [["manual", "before_restore"], KEEP_OTHER]] as const) {
    const keepIds = (await db.select({ id: backups.id }).from(backups)
      .where(inArray(backups.kind, [...kinds])).orderBy(desc(backups.createdAt)).limit(keep)).map((r) => r.id);
    if (keepIds.length) {
      await db.delete(backups).where(and(inArray(backups.kind, [...kinds]), notInArray(backups.id, keepIds)));
    }
  }
}

export async function listBackups() {
  return db.select({
    id: backups.id, kind: backups.kind, label: backups.label, summary: backups.summary,
    createdBy: backups.createdBy, createdAt: backups.createdAt,
  }).from(backups).orderBy(desc(backups.createdAt));
}

const toDate = (v: unknown) => (v ? new Date(v as string) : null);

/**
 * Puts all business data back to how it was in a backup. Logins are not touched.
 * A copy of the current data is saved first, so a restore can itself be undone.
 */
export async function restoreBackup(id: number, by: string) {
  const [b] = await db.select().from(backups).where(eq(backups.id, id));
  if (!b) throw new Error("Backup not found");
  const snap = JSON.parse(gunzipSync(Buffer.from(b.data, "base64")).toString()) as Snapshot;
  if (snap.v !== 1) throw new Error("Unknown backup format");

  const undoId = await createBackup("before_restore", by);

  await db.transaction(async (tx) => {
    await tx.delete(bills);
    await tx.delete(payments);
    await tx.delete(deliveries);
    await tx.delete(customers);

    const chunks = <T,>(arr: T[], n = 500) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
    for (const part of chunks(snap.customers)) {
      await tx.insert(customers).values(part.map((r) => ({ ...r, createdAt: toDate(r.createdAt)! })));
    }
    for (const part of chunks(snap.deliveries)) {
      await tx.insert(deliveries).values(part.map((r) => ({ ...r, createdAt: toDate(r.createdAt)! })));
    }
    for (const part of chunks(snap.payments)) {
      await tx.insert(payments).values(part.map((r) => ({ ...r, createdAt: toDate(r.createdAt)! })));
    }
    for (const part of chunks(snap.bills)) {
      await tx.insert(bills).values(part.map((r) => ({ ...r, createdAt: toDate(r.createdAt)!, sentAt: toDate(r.sentAt) })));
    }
    if (snap.settings[0]) {
      const { id: _id, ...rest } = snap.settings[0];
      void _id;
      await tx.update(settings).set(rest).where(eq(settings.id, 1));
    }
    // Keep new ids after the restored ones
    for (const t of ["customers", "deliveries", "payments", "bills"]) {
      await tx.execute(sql.raw(
        `select setval(pg_get_serial_sequence('${t}', 'id'), coalesce((select max(id) from ${t}), 1), (select count(*) from ${t}) > 0)`,
      ));
    }
  });
  return { undoId, summary: summarize(snap) };
}
