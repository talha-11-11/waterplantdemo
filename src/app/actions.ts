"use server";

import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { createBackup, restoreBackup } from "@/lib/backup";
import { closeOrdersOnDelivery, orderFromMessage, reopenOrdersOnUndo } from "@/lib/orders";
import { addDays } from "@/lib/dates";
import { pool } from "@/db";
import { DEMO_USERNAME, isDemo, seedDemo } from "../../scripts/demo-seed.mjs";
import { hashPassword, verifyPassword } from "../../scripts/password.mjs";
import { generateBills } from "@/lib/billing";
import { getSettings, pricesFor } from "@/lib/data";
import { isValidDate, isValidMonth, pkToday } from "@/lib/dates";
import { normalizePhone } from "@/lib/format";
import { sendBills, sendSummaries, type RunResult } from "@/lib/notify";

const { customers, deliveries, payments, settings } = schema;

const requireAuth = () => requireUser();

/* ---------------- Auth ---------------- */

export async function login(_: unknown, form: FormData) {
  const username = String(form.get("username") || "").trim().toLowerCase();
  const pass = String(form.get("password") || "");
  const [u] = username
    ? await db.select().from(schema.users).where(eq(schema.users.username, username))
    : [];
  if (!u || !u.active || !verifyPassword(pass, u.passwordHash)) {
    return { error: "Wrong username or password" };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ u: u.id, r: u.role as "admin", v: u.sessionVersion }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

/* ---------------- Users (super admin) ---------------- */

const usernameRule = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Username: 3–30 letters/numbers, no spaces");
const passwordRule = z.string().min(6, "Password must be at least 6 characters").max(100);

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("superadmin");
  const parsed = z.object({
    username: usernameRule,
    name: z.string().trim().max(60).default(""),
    role: z.enum(["admin", "superadmin"]),
    password: passwordRule,
  }).safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };
  const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, parsed.data.username));
  if (exists.length) return { error: "That username is taken" };
  await db.insert(schema.users).values({
    username: parsed.data.username, name: parsed.data.name, role: parsed.data.role,
    passwordHash: hashPassword(parsed.data.password),
  });
  revalidatePath("/users");
  return { ok: true };
}

export async function resetUserPassword(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("superadmin");
  const id = Number(form.get("id"));
  const p = passwordRule.safeParse(form.get("password"));
  if (!p.success) return { error: p.error.issues[0]?.message };
  // Bumping sessionVersion logs that user out on every phone
  await db.update(schema.users)
    .set({ passwordHash: hashPassword(p.data), sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, id));
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserActive(form: FormData) {
  const me = await requireUser("superadmin");
  const id = Number(form.get("id"));
  if (id === me.id) throw new Error("You can't deactivate yourself");
  const active = form.get("active") === "true";
  await db.update(schema.users)
    .set({ active, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, id));
  revalidatePath("/users");
}

export async function changeOwnPassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  if (isDemo() && me.username === DEMO_USERNAME) return { error: "The demo login's password can't be changed, so every visitor can use it." };
  if (!verifyPassword(String(form.get("current") || ""), me.passwordHash)) return { error: "Current password is wrong" };
  const p = passwordRule.safeParse(form.get("password"));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const nextVersion = me.sessionVersion + 1;
  await db.update(schema.users).set({ passwordHash: hashPassword(p.data), sessionVersion: nextVersion }).where(eq(schema.users.id, me.id));
  // Keep this phone logged in; other phones are logged out
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ u: me.id, r: me.role as "admin", v: nextVersion }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE,
  });
  return { ok: true };
}

/* ---------------- Deliveries ---------------- */

const deliverySchema = z.object({
  customerId: z.number().int().positive(),
  date: z.string().refine(isValidDate),
  std: z.number().int().min(0).max(50),
  disp: z.number().int().min(0).max(50),
  empties: z.number().int().min(0).max(100).nullable().optional(), // empty cans taken back
});

export async function saveDelivery(input: z.infer<typeof deliverySchema>) {
  await requireAuth();
  const d = deliverySchema.parse(input);
  if (d.std + d.disp === 0) return deleteDelivery(d.customerId, d.date);
  const s = await getSettings();
  const [c] = await db.select().from(customers).where(eq(customers.id, d.customerId));
  if (!c) throw new Error("Customer not found");
  const p = pricesFor(c, s);
  const amount = d.std * p.std + d.disp * p.disp;
  await db.insert(deliveries)
    .values({ customerId: d.customerId, date: d.date, std: d.std, disp: d.disp, priceStd: p.std, priceDisp: p.disp, amount, emptiesReturned: d.empties ?? null })
    .onConflictDoUpdate({
      target: [deliveries.customerId, deliveries.date],
      set: { std: d.std, disp: d.disp, priceStd: p.std, priceDisp: p.disp, amount, emptiesReturned: d.empties ?? null },
    });
  await closeOrdersOnDelivery(d.customerId, d.date);
  revalidatePath("/", "layout");
  return { amount };
}

export async function deleteDelivery(customerId: number, date: string) {
  await requireAuth();
  if (!isValidDate(date)) throw new Error("Bad date");
  await db.delete(deliveries).where(and(eq(deliveries.customerId, customerId), eq(deliveries.date, date)));
  await reopenOrdersOnUndo(customerId, date);
  revalidatePath("/", "layout");
  return { amount: 0 };
}

/* ---------------- Payments ---------------- */

const paymentSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().positive().max(10_000_000),
  method: z.enum(["cash", "jazzcash", "easypaisa", "bank"]).default("cash"),
  date: z.string().refine(isValidDate).optional(),
  note: z.string().max(200).optional(),
});

export async function addPayment(input: z.input<typeof paymentSchema>) {
  await requireAuth();
  const p = paymentSchema.parse(input);
  await db.insert(payments).values({
    customerId: p.customerId, amount: p.amount, method: p.method, date: p.date || pkToday(), note: p.note || "",
  });
  revalidatePath("/", "layout");
}

export async function addPaymentForm(form: FormData) {
  await addPayment({
    customerId: form.get("customerId") as string,
    amount: form.get("amount") as string,
    method: (form.get("method") as "cash") || "cash",
    date: (form.get("date") as string) || undefined,
    note: (form.get("note") as string) || "",
  });
  const back = form.get("redirect");
  if (typeof back === "string" && back.startsWith("/")) redirect(back);
}

export async function deletePayment(form: FormData) {
  await requireAuth();
  const id = Number(form.get("id"));
  if (id > 0) await db.delete(payments).where(eq(payments.id, id));
  revalidatePath("/", "layout");
}

/* ---------------- Customers ---------------- */

const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable());

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().min(1, "Phone is required"),
  society: z.string().trim().min(1, "Society is required").max(100),
  address: z.string().trim().max(200).default(""),
  defaultStd: z.coerce.number().int().min(0).max(50).default(0),
  defaultDisp: z.coerce.number().int().min(0).max(50).default(0),
  priceStd: optInt,
  priceDisp: optInt,
  openingBalance: z.coerce.number().int().default(0),
  startingCans: z.coerce.number().int().min(0).max(500).default(0),
  cycleDays: optInt,
  notes: z.string().max(500).default(""),
  active: z.boolean().default(true),
});

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function saveCustomer(_: FormState, form: FormData): Promise<FormState> {
  await requireAuth();
  const id = Number(form.get("id") || 0);
  const parsed = customerSchema.safeParse({
    ...Object.fromEntries(form.entries()),
    active: form.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Phone must be a Pakistani mobile number, e.g. 0300-1234567" };
  const values = { ...parsed.data, phone };

  let customerId = id;
  if (id) {
    await db.update(customers).set(values).where(eq(customers.id, id));
  } else {
    const [row] = await db.insert(customers).values(values).returning({ id: customers.id });
    customerId = row.id;
  }
  revalidatePath("/", "layout");
  redirect(`/customers/${customerId}`);
}

export async function deleteCustomer(form: FormData) {
  await requireAuth();
  const id = Number(form.get("id"));
  if (id > 0) await db.delete(customers).where(eq(customers.id, id));
  revalidatePath("/", "layout");
  redirect("/customers");
}

/* ---------------- Settings ---------------- */

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(80),
  priceStd: z.coerce.number().int().min(0).max(100000),
  priceDisp: z.coerce.number().int().min(0).max(100000),
  paymentInfo: z.string().trim().max(150).default(""),
  jazzcashNumber: z.string().trim().max(20).default(""),
  jazzcashTitle: z.string().trim().max(60).default(""),
  easypaisaNumber: z.string().trim().max(20).default(""),
  easypaisaTitle: z.string().trim().max(60).default(""),
  cameraProduction: z.preprocess((v) => v === "on", z.boolean()).default(false),
  ownerPhone: z.string().trim().max(20),
});

export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };
  const ownerPhone = parsed.data.ownerPhone ? normalizePhone(parsed.data.ownerPhone) : "";
  if (ownerPhone === null) return { error: "Owner phone must be a Pakistani mobile number" };
  await getSettings();
  await db.update(settings).set({ ...parsed.data, ownerPhone }).where(eq(settings.id, 1));
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------- Bills & WhatsApp ---------------- */

export async function generateBillsAction(form: FormData) {
  await requireAuth();
  const month = String(form.get("month"));
  if (!isValidMonth(month)) throw new Error("Bad month");
  await generateBills(month);
  revalidatePath("/bills");
}

export async function markBillSent(billId: number) {
  await requireAuth();
  if (!Number.isInteger(billId) || billId <= 0) return;
  await db.update(schema.bills).set({ sentAt: new Date() }).where(eq(schema.bills.id, billId));
  revalidatePath("/bills");
}

export async function sendBillsAction(_: unknown, form: FormData): Promise<RunResult | { error: string }> {
  await requireAuth();
  const month = String(form.get("month"));
  if (!isValidMonth(month)) return { error: "Bad month" };
  const r = await sendBills(month);
  revalidatePath("/", "layout");
  return r;
}

export async function sendSummaryAction(_: unknown, form: FormData): Promise<RunResult | { error: string }> {
  await requireAuth();
  const from = String(form.get("from"));
  const to = String(form.get("to"));
  if (!isValidDate(from) || !isValidDate(to) || from > to) return { error: "Bad dates" };
  const r = await sendSummaries(from, to);
  revalidatePath("/", "layout");
  return r;
}

/* ---------------- Backups ---------------- */

export async function backupNowAction() {
  const me = await requireUser();
  await createBackup("manual", me.username);
  revalidatePath("/backups");
}

export async function restoreAction(_: unknown, form: FormData): Promise<{ error?: string; ok?: string } | undefined> {
  const me = await requireUser();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Choose a backup" };
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm" };
  try {
    const r = await restoreBackup(id, me.username);
    revalidatePath("/", "layout");
    return { ok: `Restored: ${r.summary}. Your data from just before this restore was saved too, so you can undo it.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Restore failed" };
  }
}

/* ---------------- Demo ---------------- */

export async function resetDemoAction(_: unknown, form: FormData): Promise<{ error?: string; ok?: string } | undefined> {
  await requireUser();
  if (!isDemo()) return { error: "Only available in the demo app" };
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm" };
  const r = await seedDemo(pool);
  revalidatePath("/", "layout");
  return { ok: `Demo reset: ${r.customers} sample customers and ${r.deliveries} deliveries loaded.` };
}

/* ---------------- Inventory ---------------- */

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(80),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  lowAt: z.coerce.number().int().min(0).max(1_000_000).default(0),
  linkedTo: z.enum(["", "std", "disp"]).default(""),
  opening: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export async function createItem(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = itemSchema.safeParse(Object.fromEntries(form.entries()));
  if (!p.success) return { error: p.error.issues[0]?.message || "Invalid input" };
  const today = pkToday();
  const [item] = await db.insert(schema.inventoryItems).values({
    name: p.data.name, unit: p.data.unit, lowAt: p.data.lowAt, linkedTo: p.data.linkedTo, trackFrom: today,
  }).returning({ id: schema.inventoryItems.id });
  if (p.data.opening > 0) {
    await db.insert(schema.inventoryMoves).values({
      itemId: item.id, date: today, qty: p.data.opening, kind: "count", note: "Opening stock", createdBy: me.username,
    });
  }
  revalidatePath("/inventory");
  return { ok: true };
}

/** kind "in" adds, "out" removes, "count" sets the stock to the counted number. */
export async function stockMove(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = z.object({
    itemId: z.coerce.number().int().positive(),
    kind: z.enum(["in", "out", "count"]),
    qty: z.coerce.number().int().min(0).max(1_000_000),
    note: z.string().trim().max(120).default(""),
    current: z.coerce.number().int(),
  }).safeParse(Object.fromEntries(form.entries()));
  if (!p.success) return { error: p.error.issues[0]?.message || "Enter a number" };
  const { itemId, kind, qty, note, current } = p.data;
  if (kind !== "count" && qty === 0) return { error: "Enter a number more than 0" };
  const signed = kind === "in" ? qty : kind === "out" ? -qty : qty - current;
  if (kind === "count" && signed === 0) return { ok: true };
  await db.insert(schema.inventoryMoves).values({
    itemId, date: pkToday(), qty: signed, kind,
    note: note || (kind === "count" ? `Counted: ${qty}` : ""), createdBy: me.username,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteItem(form: FormData) {
  await requireUser();
  const id = Number(form.get("id"));
  if (id > 0) await db.delete(schema.inventoryItems).where(eq(schema.inventoryItems.id, id));
  revalidatePath("/", "layout");
  redirect("/inventory");
}

/* ---------------- Orders ---------------- */

const manualOrderSchema = z.object({
  customerId: z.coerce.number().int().positive({ message: "Choose a customer" }),
  date: z.string().refine(isValidDate, "Choose a date"),
  std: z.coerce.number().int().min(0).max(50),
  disp: z.coerce.number().int().min(0).max(50),
  note: z.string().trim().max(200).default(""),
});

export async function createManualOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = manualOrderSchema.safeParse(Object.fromEntries(form.entries()));
  if (!p.success) return { error: p.error.issues[0]?.message || "Invalid input" };
  if (p.data.std + p.data.disp === 0) return { error: "Enter at least 1 can" };
  await db.insert(schema.orders).values({ ...p.data, source: "manual", createdBy: me.username });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createPastedOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const text = String(form.get("text") || "").trim();
  if (!text) return { error: "Paste the WhatsApp message" };
  const customerId = Number(form.get("customerId")) || null;
  const r = await orderFromMessage({ text, source: "paste", by: me.username, customerId });
  // Let the owner correct what was read before it is saved
  const std = form.get("std"), disp = form.get("disp"), date = String(form.get("date") || "");
  const fix: Record<string, unknown> = {};
  if (std !== null && std !== "") fix.std = Math.max(0, Number(std) || 0);
  if (disp !== null && disp !== "") fix.disp = Math.max(0, Number(disp) || 0);
  if (isValidDate(date)) fix.date = date;
  if (Object.keys(fix).length) await db.update(schema.orders).set(fix).where(eq(schema.orders.id, r.order.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cancelOrder(form: FormData) {
  await requireUser();
  const id = Number(form.get("id"));
  if (id > 0) await db.update(schema.orders).set({ status: "cancelled", doneAt: new Date() }).where(eq(schema.orders.id, id));
  revalidatePath("/", "layout");
}

/** From the "Deliver tomorrow" list: turn a predicted customer into a real order. */
export async function orderFromCycle(form: FormData) {
  const me = await requireUser();
  const customerId = Number(form.get("customerId"));
  const date = String(form.get("date") || addDays(pkToday(), 1));
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c || !isValidDate(date)) return;
  await db.insert(schema.orders).values({
    customerId, date, std: c.defaultStd, disp: c.defaultDisp, source: "manual", note: "From delivery cycle", createdBy: me.username,
  });
  revalidatePath("/", "layout");
}

/* ---------------- Production (optional camera feature) ---------------- */

export async function saveProduction(input: { count: number; detected: number | null; method: "camera" | "manual"; itemId: number | null; note?: string }) {
  const me = await requireUser();
  const count = Math.round(Number(input.count));
  if (!Number.isFinite(count) || count <= 0 || count > 100000) throw new Error("Enter a count more than 0");
  const today = pkToday();
  await db.insert(schema.productionLogs).values({
    date: today, count, method: input.method, detected: input.detected, itemId: input.itemId,
    note: (input.note || "").slice(0, 120), createdBy: me.username,
  });
  if (input.itemId) {
    await db.insert(schema.inventoryMoves).values({
      itemId: input.itemId, date: today, qty: count, kind: "in",
      note: input.method === "camera" ? "Production (camera count)" : "Production", createdBy: me.username,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
