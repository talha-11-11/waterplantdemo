import {
  pgTable, serial, integer, text, boolean, timestamp, date, uniqueIndex, index,
} from "drizzle-orm/pg-core";

// Single row (id = 1) holding business settings
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  businessName: text("business_name").notNull().default("Pak Pure Pani"),
  priceStd: integer("price_std").notNull().default(60), // Rs per standard can
  priceDisp: integer("price_disp").notNull().default(150), // Rs per dispenser can
  paymentInfo: text("payment_info").notNull().default("JazzCash / Easypaisa: 03XX-XXXXXXX"),
  ownerPhone: text("owner_phone").notNull().default(""),
  // Payment accounts printed on bills (v2)
  jazzcashNumber: text("jazzcash_number").notNull().default(""),
  jazzcashTitle: text("jazzcash_title").notNull().default(""),
  easypaisaNumber: text("easypaisa_number").notNull().default(""),
  easypaisaTitle: text("easypaisa_title").notNull().default(""),
  cameraProduction: boolean("camera_production").notNull().default(false), // optional feature (v5)
});

// App logins (v2). role: "superadmin" (PokitBio) | "admin" (business owner)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  active: boolean("active").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(1), // bump to log the user out everywhere
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_username_uq").on(t.username)]);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(), // 923001234567 (no +)
  society: text("society").notNull(),
  address: text("address").notNull().default(""),
  defaultStd: integer("default_std").notNull().default(0),
  defaultDisp: integer("default_disp").notNull().default(0),
  priceStd: integer("price_std"), // null = use settings price
  priceDisp: integer("price_disp"),
  openingBalance: integer("opening_balance").notNull().default(0),
  startingCans: integer("starting_cans").notNull().default(0), // empty cans given to the customer at start (v2)
  cycleDays: integer("cycle_days"), // v5: "delivers every N days" set by hand; null = learn from history
  active: boolean("active").notNull().default(true),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("customers_society_idx").on(t.society)]);

export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  date: date("date").notNull(), // 'YYYY-MM-DD' in Pakistan time
  std: integer("std").notNull().default(0),
  disp: integer("disp").notNull().default(0),
  priceStd: integer("price_std").notNull(), // snapshot
  priceDisp: integer("price_disp").notNull(),
  amount: integer("amount").notNull(),
  emptiesReturned: integer("empties_returned"), // v5: empty cans taken back; null = same as delivered
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("deliveries_customer_date_uq").on(t.customerId, t.date),
  index("deliveries_date_idx").on(t.date),
]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default("cash"), // cash | jazzcash | easypaisa | bank
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("payments_date_idx").on(t.date)]);

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // '2026-11'
  std: integer("std").notNull(),
  disp: integer("disp").notNull(),
  charges: integer("charges").notNull(),
  previousBalance: integer("previous_balance").notNull(),
  paymentsInMonth: integer("payments_in_month").notNull(),
  totalDue: integer("total_due").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
}, (t) => [uniqueIndex("bills_customer_month_uq").on(t.customerId, t.month)]);

export const messageLog = pgTable("message_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // summary | bill
  period: text("period").notNull(), // '2026-11-01..2026-11-10' or '2026-11'
  status: text("status").notNull(), // sent | dry_run | failed
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("message_log_lookup_idx").on(t.customerId, t.kind, t.period)]);

// Saved copies of all business data (v3). One automatic copy per day (start of day),
// plus manual copies and an automatic copy just before every restore.
export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(), // daily: "2026-11-19"; others: ISO time
  kind: text("kind").notNull(), // daily | manual | before_restore
  summary: text("summary").notNull().default(""),
  data: text("data").notNull(), // gzip + base64 JSON
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("backups_kind_label_uq").on(t.kind, t.label)]);

// Inventory (v4): stock items and every stock movement.
// Stock = sum of moves; items linked to "std"/"disp" also go down with deliveries from trackFrom on.
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("pcs"),
  lowAt: integer("low_at").notNull().default(0), // show "Low stock" at or below this
  linkedTo: text("linked_to").notNull().default(""), // "" | "std" | "disp"
  trackFrom: date("track_from").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryMoves = pgTable("inventory_moves", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  qty: integer("qty").notNull(), // + in, − out
  kind: text("kind").notNull(), // in | out | count
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("inventory_moves_item_idx").on(t.itemId)]);

export type InventoryItem = typeof inventoryItems.$inferSelect;

// Orders (v5): from WhatsApp (inbox or pasted message) or entered by hand
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  fromName: text("from_name").notNull().default(""), // when no customer matched
  fromPhone: text("from_phone").notNull().default(""),
  date: date("date").notNull(), // wanted on
  std: integer("std").notNull().default(0),
  disp: integer("disp").notNull().default(0),
  note: text("note").notNull().default(""),
  source: text("source").notNull().default("manual"), // manual | paste | whatsapp
  status: text("status").notNull().default("open"), // open | delivered | cancelled
  rawText: text("raw_text").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  doneAt: timestamp("done_at"),
}, (t) => [index("orders_date_status_idx").on(t.date, t.status)]);

// Production log (v5, optional camera feature)
export const productionLogs = pgTable("production_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  count: integer("count").notNull(),
  method: text("method").notNull().default("manual"), // camera | manual
  detected: integer("detected"), // what the camera counted before any correction
  itemId: integer("item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;

export type Customer = typeof customers.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type User = typeof users.$inferSelect;
