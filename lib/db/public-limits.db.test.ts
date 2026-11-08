import { beforeEach, describe, expect, it, vi } from "vitest";

/* The public forms send mail to whatever address is typed and store what's
   uploaded, so each connection gets an hourly allowance. The connection is the
   one thing faked here, with the headers a proxy would send. */

const request = vi.hoisted(() => ({ headers: {} as Record<string, string> }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(request.headers),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

import { BETA_AGREEMENT_VERSION } from "@/lib/applications.util";
import { resendApplicationCode, submitApplication } from "@/lib/apply";
import { addCircle, addMember, codeRequestCount, resetDb } from "./testing";

const form = (email: string, over: Record<string, string> = {}) => {
  const f = new FormData();
  const fields: Record<string, string> = { firstName: "Ona", lastName: "Park", email, neighborhoodId: "the903", agreementVersion: BETA_AGREEMENT_VERSION, ...over };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  f.set("photo", new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])], { type: "image/jpeg" }));
  return f;
};

beforeEach(async () => {
  request.headers = { "x-real-ip": "203.0.113.7" };
  await resetDb();
  await addMember(1);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
});

describe("applying to join, from one connection", () => {
  it("is allowed ten starts an hour, then refused", async () => {
    for (let i = 0; i < 10; i++) expect((await submitApplication(form(`a${i}@example.test`))).ok, `start ${i}`).toBe(true);
    const refused = await submitApplication(form("late@example.test"));
    expect(refused).toMatchObject({ ok: false });
    expect((refused as { error: string }).error).toMatch(/Too many codes/);
    expect(await codeRequestCount()).toBe(10);
  });

  it("is counted per connection, not for everyone", async () => {
    for (let i = 0; i < 10; i++) await submitApplication(form(`a${i}@example.test`));
    request.headers = { "x-real-ip": "198.51.100.9" };
    expect((await submitApplication(form("other@example.test"))).ok).toBe(true);
  });

  it("doesn't spend the allowance on a form that's incomplete", async () => {
    for (let i = 0; i < 20; i++) await submitApplication(form(`b${i}@example.test`, { firstName: "" }));
    expect(await codeRequestCount()).toBe(0);
  });

  it("can't be dodged by inventing the start of x-forwarded-for", async () => {
    for (let i = 0; i < 10; i++) {
      request.headers = { "x-forwarded-for": `10.0.0.${i}, 192.0.2.50` };
      await submitApplication(form(`c${i}@example.test`));
    }
    request.headers = { "x-forwarded-for": "10.9.9.9, 192.0.2.50" };
    expect(await submitApplication(form("late@example.test"))).toMatchObject({ ok: false });
  });

  it("counts asking for another code too", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const first = await submitApplication(form("ona@example.test"));
      const id = (first as { id: string }).id;
      // a code is only asked for again after the minute the address must wait
      for (let i = 0; i < 9; i++) {
        vi.setSystemTime(Date.now() + 61_000);
        expect((await resendApplicationCode(id)).ok, `resend ${i}`).toBe(true);
      }
      vi.setSystemTime(Date.now() + 61_000);
      const refused = await resendApplicationCode(id);
      expect((refused as { error: string }).error).toMatch(/Too many codes/);
    } finally {
      vi.useRealTimers();
    }
  });
});
