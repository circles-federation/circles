import webpush, { WebPushError } from "web-push";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// what public/sw.js shows: `url` is a path in this app, opened on a tap, and
// a later message with the same `tag` replaces an earlier one on the device
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// the push service says this subscription is gone for good (the app was
// uninstalled, or notifications turned off): delete it rather than retry
export class ExpiredSubscriptionError extends Error {}

/* The only file that imports "web-push" (the same wrapping rule as lib/email/
   and lib/db/) — everything else sends through sendPush(). It's the standard
   Web Push protocol, so the same code reaches every browser: the endpoint
   belongs to whichever push service the device's browser uses (Apple's,
   Google's FCM, Mozilla's), and the payload is end-to-end encrypted to the
   device, so that service can't read it.

   NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are this server's
   keypair (`npx web-push generate-vapid-keys`), VAPID_SUBJECT a mailto: the
   push services can reach the operator at. Without them, development just
   logs the message; production throws rather than silently dropping it. */
let configured = false;

function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

// a push held this long by the push service (the device off, say) is dropped:
// a day-old "new event" or reminder is worse than none
const TTL_SECONDS = 24 * 60 * 60;

export async function sendPush(subscription: PushSubscriptionKeys, message: PushMessage): Promise<void> {
  if (!configure()) {
    if (process.env.NODE_ENV === "production") throw new Error("Push isn't configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.");
    console.log(`[push not sent — VAPID keys unset]\nTo: ${subscription.endpoint}\n${message.title}\n${message.body}\n${message.url}`);
    return;
  }
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(message),
      { TTL: TTL_SECONDS, timeout: 10_000 }
    );
  } catch (err) {
    if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) throw new ExpiredSubscriptionError(err.message);
    throw err;
  }
}
