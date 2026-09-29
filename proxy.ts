import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/* Route gate for the session Better Auth sets (see lib/better-auth.ts). Named
   `proxy` (not `middleware`) and in this file (not middleware.ts) because
   Next 16 renamed the convention — this is not a typo. `/` is excluded
   in-body rather than via the matcher regex, since it's the one route that
   must always be reachable (it's both the welcome page and the redirect
   target below) and a matcher mistake there is exactly how you get a
   redirect loop.

   getSessionCookie() is a presence-only check (decodes the cookie, doesn't
   validate it against the DB) — deliberately cheap and Edge-safe, since this
   middleware can't hold a real Postgres connection the way lib/better-auth.ts
   does. app/(app)/layout.tsx's getCurrentUserId() is what actually validates
   the session; this is the fast, defensive first gate, same division of
   labor the mock cookie check had before. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // the welcome page, applying to join, and the beta terms and privacy notes
  // an applicant agrees to — all for people without a session
  if (pathname === "/" || pathname === "/apply" || pathname === "/terms" || pathname === "/privacy") return NextResponse.next();
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

// the manifest and app icons are skipped too: a browser fetches them without
// cookies, so gating them would hand it the welcome page instead and quietly
// break installing the app
export const config = {
  matcher: ["/((?!_next/static|_next/image|manifest\\.webmanifest|icons/|icon\\.svg|apple-icon\\.png).*)"],
};
