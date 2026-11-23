import { describe, expect, it } from "vitest";
import { readToken, signToken } from "./signed-token.util";

describe("signed tokens", () => {
  it("reads back what was signed", () => {
    const token = signToken({ email: "a@b.test" }, "s3cret", 1000, 0);
    expect(readToken<{ email: string }>(token, "s3cret", 500)?.email).toBe("a@b.test");
  });
  it("refuses an expired token", () => {
    expect(readToken(signToken({ a: 1 }, "s3cret", 1000, 0), "s3cret", 1000)).toBeNull();
  });
  it("refuses a different secret or a tampered payload", () => {
    const token = signToken({ email: "a@b.test" }, "s3cret", 1000, 0);
    expect(readToken(token, "other", 1)).toBeNull();
    const [, mac] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ email: "x@y.test", exp: 9e12 })).toString("base64url")}.${mac}`;
    expect(readToken(forged, "s3cret", 1)).toBeNull();
  });
  it("refuses junk and a missing secret", () => {
    expect(readToken(undefined, "s3cret")).toBeNull();
    expect(readToken("a.b.c", "s3cret")).toBeNull();
    expect(readToken(signToken({}, "", 1000), "")).toBeNull();
  });
});
