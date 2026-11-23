import { createHmac, timingSafeEqual } from "node:crypto";

/* A small tamper-proof token for a cookie the server hands out and reads back:
   the payload as base64url JSON, a dot, and its HMAC. `exp` (ms since epoch)
   is checked on the way back, so a token can't be kept for later. */

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signToken(payload: object, secret: string, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ttlMs })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readToken<T extends object>(token: string | undefined, secret: string, now = Date.now()): T | null {
  if (!token || !secret) return null;
  const [body, mac, ...extra] = token.split(".");
  if (!body || !mac || extra.length) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > now ? parsed : null;
  } catch {
    return null;
  }
}
