import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { pushSubscriptions } from "./schema";
import type { PushSubscriptionKeys } from "@/lib/push";

export class PushError extends UserFacingError {}

/* The push services browsers actually use. A subscription's endpoint is a URL
   the server will POST to, and it comes from the browser, so anything else is
   refused: otherwise a member could point this server's requests anywhere. */
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

function isPushServiceUrl(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

const isKey = (s: unknown): s is string => typeof s === "string" && s.length > 0 && s.length <= 200 && /^[A-Za-z0-9_-]+=*$/.test(s);

/* Turn push on for this device, as `memberId`. The endpoint is the key, so a
   device someone else signed in on before is moved to whoever's saving it now
   (the app re-saves on every open, see lib/push-client.ts). */
export async function saveSubscription(memberId: number, sub: PushSubscriptionKeys): Promise<void> {
  if (typeof sub?.endpoint !== "string" || sub.endpoint.length > 1000 || !isPushServiceUrl(sub.endpoint) || !isKey(sub.p256dh) || !isKey(sub.auth)) {
    throw new PushError("This device's notification settings weren't recognized.");
  }
  const row = { endpoint: sub.endpoint, memberId, p256dh: sub.p256dh, auth: sub.auth };
  await db
    .insert(pushSubscriptions)
    .values(row)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { memberId, p256dh: sub.p256dh, auth: sub.auth } });
}

// turn push off for one of `memberId`'s own devices (signing out, say)
export async function deleteSubscription(memberId: number, endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.memberId, memberId)));
}

export async function getSubscriptions(memberId: number): Promise<PushSubscriptionKeys[]> {
  return db
    .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.memberId, memberId));
}

// the push service said the device is gone for good
export async function deleteDeadSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function markSubscriptionUsed(endpoint: string): Promise<void> {
  await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(eq(pushSubscriptions.endpoint, endpoint));
}
