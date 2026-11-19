import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { SESSION_COOKIE, readSession } from "./auth";

/** The logged-in user, checked against the database (active + not logged out). */
export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const s = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, s.u));
  if (!u || !u.active || u.sessionVersion !== s.v) return null;
  return u;
});

/** For server actions: throws if not logged in (or not super admin when required). */
export async function requireUser(role?: "superadmin"): Promise<User> {
  const u = await currentUser();
  if (!u) throw new Error("Please log in again");
  if (role && u.role !== role) throw new Error("Only PokitBio super admin can do this");
  return u;
}

/** For pages: redirects to login instead of throwing. */
export async function pageUser(role?: "superadmin"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) redirect("/");
  return u;
}
