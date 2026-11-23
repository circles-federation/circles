import { NextResponse, type NextRequest } from "next/server";
import { getMemberByEmail } from "@/lib/db/members";
import { GOOGLE_APPLICANT_COOKIE, GOOGLE_APPLICANT_MS, GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_MS, applicantToken, finishApplyFlow, googleEnabled, startApplyFlow } from "@/lib/google";

/* "Apply with Google" (see lib/google.ts). With no `code` it starts the flow and
   sends the browser to Google; with one, it's Google sending them back: the
   verified address goes in a signed cookie and the browser on to the join page,
   which fills the form from it. Public (proxy.ts), since an applicant has no
   session. */
const cookieOptions = (maxAgeMs: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeMs / 1000 });

export async function GET(request: NextRequest) {
  const base = request.nextUrl;
  const back = (query: string) => NextResponse.redirect(new URL(`/join${query}`, process.env.BETTER_AUTH_URL ?? base));
  if (!googleEnabled()) return back("");
  const code = base.searchParams.get("code");
  const state = base.searchParams.get("state");
  if (!code || !state) {
    // a refusal at Google's (they declined, say) comes back with ?error=
    if (base.searchParams.get("error")) return back("?google=failed");
    const { url, cookie } = startApplyFlow(base.searchParams.get("neighborhood") ?? "");
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_FLOW_COOKIE, cookie, cookieOptions(GOOGLE_FLOW_MS));
    return res;
  }
  let result;
  try {
    result = await finishApplyFlow(code, state, request.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
  } catch (err) {
    console.error("Couldn't finish Apply with Google:", err);
  }
  // a member who pressed Apply instead of Sign in is sent to sign in, not
  // through a form that could only end in a refusal
  if (result && (await getMemberByEmail(result.applicant.email))) {
    const res = NextResponse.redirect(new URL("/?error=already_member", process.env.BETTER_AUTH_URL ?? base));
    res.cookies.delete(GOOGLE_FLOW_COOKIE);
    return res;
  }
  const res = result ? back(result.neighborhood ? `?neighborhood=${encodeURIComponent(result.neighborhood)}` : "") : back("?google=failed");
  res.cookies.delete(GOOGLE_FLOW_COOKIE);
  if (result) res.cookies.set(GOOGLE_APPLICANT_COOKIE, applicantToken(result.applicant), cookieOptions(GOOGLE_APPLICANT_MS));
  return res;
}
