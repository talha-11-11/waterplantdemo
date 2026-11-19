import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

// Quick gate: valid signed session or go to login. Pages and actions then
// re-check the user in the database (active, not logged out, role).
export async function middleware(req: NextRequest) {
  const ok = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except login, public bill links, cron (own secret), health, Next internals and public files.
  matcher: ["/((?!login|b/|api/cron|api/health|_next/static|_next/image|favicon.ico|logo.png|pokitbio.png|pay/|manifest.webmanifest|icon-.*\\.png).*)"],
};
