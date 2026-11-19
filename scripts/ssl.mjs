/**
 * SSL setting for a Postgres URL.
 * DATABASE_SSL=disable | require overrides. Otherwise: no SSL for localhost and
 * Render's internal hostnames (no dot, e.g. dpg-abc123-a); SSL for everything else
 * (Supabase, Neon, Render external URLs).
 */
export function sslFor(url) {
  const mode = process.env.DATABASE_SSL;
  if (mode === "disable") return undefined;
  if (mode === "require") return { rejectUnauthorized: false };
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1" || !host.includes(".")) return undefined;
  } catch {
    /* fall through */
  }
  return { rejectUnauthorized: false };
}
