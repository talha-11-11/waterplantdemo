import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { InventoryItem } from "@/db/schema";

const { inventoryItems, inventoryMoves, deliveries } = schema;

export type ItemWithStock = InventoryItem & { stock: number; delivered: number; low: boolean };

/** Cans delivered (std or disp) from a date on, for items linked to deliveries. */
async function deliveredSince(kind: string, from: string): Promise<number> {
  if (kind !== "std" && kind !== "disp") return 0;
  const col = kind === "std" ? deliveries.std : deliveries.disp;
  const [r] = await db.select({ n: sql<string>`coalesce(sum(${col}),0)` }).from(deliveries).where(gte(deliveries.date, from));
  return Number(r?.n ?? 0);
}

export async function itemsWithStock(includeInactive = false): Promise<ItemWithStock[]> {
  const items = await db.select().from(inventoryItems)
    .where(includeInactive ? undefined : eq(inventoryItems.active, true))
    .orderBy(asc(inventoryItems.id));
  const sums = await db.select({ itemId: inventoryMoves.itemId, qty: sql<string>`sum(${inventoryMoves.qty})` })
    .from(inventoryMoves).groupBy(inventoryMoves.itemId);
  const byItem = new Map(sums.map((s) => [s.itemId, Number(s.qty)]));
  return Promise.all(items.map(async (it) => {
    const delivered = await deliveredSince(it.linkedTo, it.trackFrom);
    const stock = (byItem.get(it.id) ?? 0) - delivered;
    return { ...it, stock, delivered, low: stock <= it.lowAt };
  }));
}

export async function itemHistory(itemId: number, limit = 30) {
  return db.select().from(inventoryMoves).where(eq(inventoryMoves.itemId, itemId))
    .orderBy(desc(inventoryMoves.date), desc(inventoryMoves.id)).limit(limit);
}

export async function deliveriesByDay(kind: string, from: string, limit = 10) {
  if (kind !== "std" && kind !== "disp") return [];
  const col = kind === "std" ? deliveries.std : deliveries.disp;
  return db.select({ date: deliveries.date, n: sql<string>`sum(${col})` }).from(deliveries)
    .where(and(gte(deliveries.date, from)))
    .groupBy(deliveries.date).orderBy(desc(deliveries.date)).limit(limit);
}

/** Customers' starting (empty) cans, i.e. cans out with customers. */
export async function cansWithCustomers(): Promise<number> {
  const [r] = await db.select({ n: sql<string>`coalesce(sum(${schema.customers.startingCans}),0)` })
    .from(schema.customers).where(eq(schema.customers.active, true));
  return Number(r?.n ?? 0);
}
