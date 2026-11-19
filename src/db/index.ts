import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { sslFor } from "../../scripts/ssl.mjs";

const globalForDb = globalThis as unknown as { pool?: Pool };

const url = process.env.DATABASE_URL;

const pool =
  globalForDb.pool ??
  new Pool({ connectionString: url, max: 5, ssl: url ? sslFor(url) : undefined });

globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
