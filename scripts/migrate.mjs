// Runs on every start-up:
//  1. applies database migrations (./drizzle). Already-applied ones are skipped and
//     every migration only ADDS tables/columns, so existing data is never touched.
//  2. creates the first logins from environment variables, only if those usernames
//     don't exist yet (passwords changed later in the app are never overwritten).
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { sslFor } from "./ssl.mjs";
import { hashPassword } from "./password.mjs";
import { DEMO_PASSWORD, DEMO_USERNAME, isDemo, seedDemo } from "./demo-seed.mjs";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1, ssl: sslFor(url) });

async function ensureUser(username, password, role, name) {
  if (!username || !password) {
    console.warn(`No password set for ${role} login (${username || "no username"}), skipped`);
    return;
  }
  const u = username.trim().toLowerCase();
  const { rows } = await pool.query("select id from users where username = $1", [u]);
  if (rows.length) return;
  await pool.query(
    "insert into users (username, name, password_hash, role) values ($1, $2, $3, $4)",
    [u, name, hashPassword(password), role],
  );
  console.log(`Created ${role} login: ${u}`);
}

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Database ready");
  await ensureUser(process.env.SUPERADMIN_USERNAME || "pokitbio", process.env.SUPERADMIN_PASSWORD, "superadmin", "PokitBio");
  if (isDemo()) {
    await ensureUser(DEMO_USERNAME, DEMO_PASSWORD, "admin", "Demo Owner");
    const { rows } = await pool.query("select count(*)::int as n from customers");
    if (rows[0].n === 0) {
      const r = await seedDemo(pool);
      console.log(`Demo data loaded: ${r.customers} customers, ${r.deliveries} deliveries`);
    }
  }
  if (process.env.ADMIN_USERNAME) {
    await ensureUser(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD, "admin", process.env.ADMIN_USERNAME);
  }
} catch (e) {
  console.error("Start-up database step failed:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
