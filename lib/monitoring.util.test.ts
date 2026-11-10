import { describe, expect, it } from "vitest";
import { REPORT_MESSAGE_MAX, scrubMessage, scrubPath, scrubReport } from "./monitoring.util";

describe("scrubMessage", () => {
  it("drops a failed query's parameters, which are what a member typed", () => {
    const m = scrubMessage('Failed query: insert into "circle_chat_messages" ("body") values ($1)\nparams: my private message,7');
    expect(m).toBe('Failed query: insert into "circle_chat_messages" ("body") values ($1)');
    expect(m).not.toContain("private");
  });

  it("hides email addresses", () => {
    expect(scrubMessage("No mailbox for mira@example.test")).toBe("No mailbox for [email]");
  });

  it("cuts a long message short", () => {
    expect(scrubMessage("x".repeat(REPORT_MESSAGE_MAX + 50))).toHaveLength(REPORT_MESSAGE_MAX + 1);
  });
});

describe("scrubReport", () => {
  it("keeps the error and where it came from, and nothing about a person", () => {
    const out = scrubReport({
      message: "Boom for a@b.org",
      exception: { values: [{ value: "Failed query: select 1\nparams: secret" }] },
      request: { url: "https://circles.example/circles/x?token=abc#frag", headers: { cookie: "session=1" } } as { url: string },
      user: { id: 5, email: "a@b.org" },
      extra: { body: "text" },
      breadcrumbs: [{ message: "typed" }],
      release: "abc123",
    });
    expect(out).toEqual({
      message: "Boom for [email]",
      exception: { values: [{ value: "Failed query: select 1" }] },
      request: { url: "/circles/x" },
      release: "abc123",
    });
  });

  it("hides the secret in a shared-event link or a guest's stop link", () => {
    expect(scrubReport({ request: { url: "https://x.test/e/s3cr3t-token" } }).request?.url).toBe("/e/[redacted]");
    expect(scrubReport({ request: { url: "https://x.test/e/stop/guest-id" } }).request?.url).toBe("/e/stop/[redacted]");
  });

  it("drops a request it can't read the address of", () => {
    expect(scrubReport({ request: {} }).request).toBeUndefined();
  });
});

describe("scrubPath", () => {
  it("keeps a route's path and drops its query and any shared-link secret", () => {
    expect(scrubPath("/circles/finance-council/wiki?code=123456")).toBe("/circles/finance-council/wiki");
    expect(scrubPath("/e/s3cr3t")).toBe("/e/[redacted]");
  });
});
