import { NextResponse } from "next/server";

/* Route gate for the mock session cookie set by lib/auth.js. Named `proxy`
   (not `middleware`) and in this file (not middleware.js) because Next 16
   renamed the convention — this is not a typo. `/` is excluded in-body
   rather than via the matcher regex, since it's the one route that must
   always be reachable (it's both the welcome page and the redirect target
   below) and a matcher mistake there is exactly how you get a redirect loop. */
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") return NextResponse.next();
  if (!request.cookies.get("session")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
