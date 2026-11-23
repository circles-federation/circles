import { createHash, randomBytes } from "node:crypto";
import { readToken, signToken } from "@/lib/signed-token.util";

/* "Apply with Google": Google vouches for an address, so the application skips
   the emailed code (as a guest's from an event's share link does). Unlike
   signing in (Better Auth's Google provider, lib/better-auth.ts), nobody is
   signed in or given an account here: this is a plain authorization-code flow
   with PKCE, and all that comes out of it is a short-lived signed cookie
   naming the verified address and the name Google has for it, which the join
   page and submitApplication read back. The ID token comes straight from
   Google's token endpoint over TLS, which is what OpenID Connect lets a
   server trust without checking its signature; its audience, issuer, expiry
   and email_verified are still checked. */

export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// the two short-lived cookies: the flow in progress, and the proved applicant
export const GOOGLE_FLOW_COOKIE = "google_apply_flow";
export const GOOGLE_APPLICANT_COOKIE = "google_applicant";
export const GOOGLE_FLOW_MS = 10 * 60_000;
export const GOOGLE_APPLICANT_MS = 30 * 60_000;

export interface GoogleApplicant {
  email: string;
  firstName: string;
  lastName: string;
}

const secret = () => process.env.BETTER_AUTH_SECRET ?? "";
export const googleApplyRedirectUri = () => `${(process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/api/google/apply`;

export const readApplicant = (cookie: string | undefined) => readToken<GoogleApplicant>(cookie, secret());

export const applicantToken = (applicant: GoogleApplicant) => signToken(applicant, secret(), GOOGLE_APPLICANT_MS);

// where to send the browser, and the flow cookie that lets the callback check
// it's the same browser coming back
export function startApplyFlow(neighborhood: string): { url: string; cookie: string } {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleApplyRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    cookie: signToken({ state, verifier, neighborhood }, secret(), GOOGLE_FLOW_MS),
  };
}

interface Flow {
  state: string;
  verifier: string;
  neighborhood: string;
}

// the callback: null if anything doesn't check out
export async function finishApplyFlow(code: string, state: string, flowCookie: string | undefined): Promise<{ applicant: GoogleApplicant; neighborhood: string } | null> {
  const flow = readToken<Flow>(flowCookie, secret());
  if (!flow || flow.state !== state) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleApplyRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
  });
  if (!res.ok) return null;
  const idToken = ((await res.json()) as { id_token?: string }).id_token;
  const claims = parseClaims(idToken);
  if (!claims) return null;
  const [first = "", ...rest] = (claims.name ?? "").trim().split(/\s+/);
  return {
    applicant: {
      email: claims.email.trim().toLowerCase(),
      firstName: claims.given_name?.trim() || first,
      lastName: claims.family_name?.trim() || rest.join(" "),
    },
    neighborhood: flow.neighborhood,
  };
}

interface Claims {
  iss?: string;
  aud?: string;
  exp?: number;
  email: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

function parseClaims(idToken: string | undefined): Claims | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
    const verified = c.email_verified === true || c.email_verified === "true";
    const issuer = c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com";
    if (!c.email || !verified || !issuer || c.aud !== process.env.GOOGLE_CLIENT_ID || !c.exp || c.exp * 1000 < Date.now()) return null;
    return c;
  } catch {
    return null;
  }
}
