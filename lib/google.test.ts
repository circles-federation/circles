import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applicantToken, finishApplyFlow, readApplicant, startApplyFlow } from "./google";
import { signToken } from "./signed-token.util";

const idToken = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
const good = () => ({ iss: "https://accounts.google.com", aud: "client-id", exp: Math.floor(Date.now() / 1000) + 600, email: "Ona@Example.test", email_verified: true, name: "Ona Lee Park", given_name: "Ona", family_name: "Lee Park" });

function respondWith(body: object, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));
}

// begins a flow and returns what Google would hand back with the code
function begin() {
  const { url, cookie } = startApplyFlow("the903");
  return { cookie, state: new URL(url).searchParams.get("state") ?? "" };
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("finishApplyFlow", () => {
  it("returns the verified applicant, the address lowercased", async () => {
    respondWith({ id_token: idToken(good()) });
    const { cookie, state } = begin();
    expect(await finishApplyFlow("code", state, cookie)).toEqual({ applicant: { email: "ona@example.test", firstName: "Ona", lastName: "Lee Park" }, neighborhood: "the903" });
  });

  it("falls back to splitting the full name", async () => {
    respondWith({ id_token: idToken({ ...good(), given_name: undefined, family_name: undefined }) });
    const { cookie, state } = begin();
    expect((await finishApplyFlow("code", state, cookie))?.applicant).toMatchObject({ firstName: "Ona", lastName: "Lee Park" });
  });

  it("accepts the other issuer form and a string email_verified", async () => {
    respondWith({ id_token: idToken({ ...good(), iss: "accounts.google.com", email_verified: "true" }) });
    const { cookie, state } = begin();
    expect(await finishApplyFlow("code", state, cookie)).not.toBeNull();
  });

  it.each([
    ["an unverified email", { email_verified: false }],
    ["a missing email_verified", { email_verified: undefined }],
    ["another audience", { aud: "someone-else" }],
    ["another issuer", { iss: "https://evil.test" }],
    ["an expired token", { exp: Math.floor(Date.now() / 1000) - 5 }],
    ["no expiry", { exp: undefined }],
    ["no email", { email: undefined }],
  ])("refuses %s", async (_, over) => {
    respondWith({ id_token: idToken({ ...good(), ...over }) });
    const { cookie, state } = begin();
    expect(await finishApplyFlow("code", state, cookie)).toBeNull();
  });

  it("refuses a state that isn't the flow's, a missing cookie, or a flow cookie forged with another purpose", async () => {
    respondWith({ id_token: idToken(good()) });
    const { cookie, state } = begin();
    expect(await finishApplyFlow("code", "other", cookie)).toBeNull();
    expect(await finishApplyFlow("code", state, undefined)).toBeNull();
    const wrong = signToken({ state, verifier: "v", neighborhood: "", purpose: "applicant" }, "test-secret", 60_000);
    expect(await finishApplyFlow("code", state, wrong)).toBeNull();
  });

  it("refuses when Google's token endpoint does, or sends no token or junk", async () => {
    const { cookie, state } = begin();
    respondWith({}, false);
    expect(await finishApplyFlow("code", state, cookie)).toBeNull();
    respondWith({});
    expect(await finishApplyFlow("code", state, cookie)).toBeNull();
    respondWith({ id_token: "x.not-json.y" });
    expect(await finishApplyFlow("code", state, cookie)).toBeNull();
  });
});

describe("readApplicant", () => {
  it("reads back an applicant's token", () => {
    const applicant = { email: "a@b.test", firstName: "A", lastName: "B" };
    expect(readApplicant(applicantToken(applicant))).toEqual(applicant);
  });

  it("refuses the flow's own cookie, a token without an email, and nothing", () => {
    expect(readApplicant(begin().cookie)).toBeNull();
    expect(readApplicant(signToken({ purpose: "applicant", firstName: "A", lastName: "B" }, "test-secret", 60_000))).toBeNull();
    expect(readApplicant(undefined)).toBeNull();
  });
});
