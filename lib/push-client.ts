import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/db/actions";
import type { PushSubscriptionKeys } from "@/lib/push";
import { markPromptAnswered, promptAnswered, PUSH_PROMPT_KEY } from "@/lib/home-prompts";

/* The browser's side of push notifications (the server's is lib/push/ and
   lib/notify.ts): registering public/sw.js, and turning push on or off for
   this device. Browser-only, so call it from effects and taps. */

export const SERVICE_WORKER_URL = "/sw.js";

// Home asks once per device whether to turn push on (PushPrompt): answered
// either way there, or by turning it on or off in Settings, it isn't asked again
export const pushPromptAnswered = () => promptAnswered(PUSH_PROMPT_KEY);
export const markPushPromptAnswered = () => markPromptAnswered(PUSH_PROMPT_KEY);

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// this device's subscription, if push is on here. getRegistration rather than
// `ready`, which never settles where nothing was registered.
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/* Whether this device may push, asked of push itself: Safari keeps push's
   permission apart from notifications', so Notification.permission can say
   "granted" while subscribe() is refused as denied. Notification.permission
   is only the fallback where push can't be asked. */
export async function pushPermission(): Promise<PermissionState> {
  const registration = await navigator.serviceWorker.getRegistration();
  const state = await registration?.pushManager.permissionState?.({ userVisibleOnly: true }).catch(() => undefined);
  if (state) return state;
  return Notification.permission === "default" ? "prompt" : Notification.permission;
}

function toKeys(sub: PushSubscription): PushSubscriptionKeys {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

/* Register the service worker and, if this device already has push on, save
   its subscription again: that puts back a row the server lost, follows a
   browser that rotated it, and moves it to whoever is signed in now. One made
   with a push key the server no longer has (its keys were rotated) can never
   be pushed to, so it's replaced with one for the current key; push is
   already allowed here, so that needs no tap, and if the browser refuses
   anyway push is simply off on this device until it's turned on again. Run
   once when the app opens (AppShell). */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  if (!("PushManager" in window)) return;
  let sub = await registration.pushManager.getSubscription();
  if (sub && !madeWithCurrentKey(sub)) {
    sub = await replaceStaleSubscription(registration, sub).catch((err) => {
      console.error("Couldn't renew this device's push subscription:", err);
      return null;
    });
  }
  if (sub) {
    const result = await savePushSubscriptionAction(toKeys(sub));
    if (!result.ok) console.error(result.error);
  }
}

// whether a subscription was made with the push key this build has; one whose
// browser doesn't say is taken to be current, rather than churned for nothing
function madeWithCurrentKey(sub: PushSubscription): boolean {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const made = sub.options.applicationServerKey;
  if (!key || !made) return true;
  const current = keyBytes(key);
  const bytes = new Uint8Array(made);
  return bytes.length === current.length && bytes.every((b, i) => b === current[i]);
}

// a subscription for the current key in place of one for an old key: the old
// one's server row goes first, while there's a session to delete it with
async function replaceStaleSubscription(registration: ServiceWorkerRegistration, stale: PushSubscription): Promise<PushSubscription> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  await deletePushSubscriptionAction(stale.endpoint);
  await stale.unsubscribe();
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
}

// base64url, as the VAPID public key is written, to the bytes subscribe() takes
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/* Turn push on for this device. Must run from a tap: browsers only show the
   permission prompt for one. Resolves to whether it's now on — false if the
   person said no — and throws if something else went wrong. */
export async function subscribeThisDevice(): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Push isn't configured on this server.");
  // subscribe() asks for permission itself, and is reached as soon after the
  // tap as possible: Safari only lets it ask within about a second of one, so
  // a separate requestPermission() first (its prompt waiting on the person)
  // left subscribe() refused. AppShell has normally registered the worker
  // long before; waiting on `ready` is only for when it hasn't.
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register(SERVICE_WORKER_URL));
  const active = registration.active ? registration : await navigator.serviceWorker.ready;
  let sub: PushSubscription;
  try {
    // one left over from an old push key is no use: start a new one
    const existing = await active.pushManager.getSubscription();
    if (existing && !madeWithCurrentKey(existing)) await existing.unsubscribe();
    sub = (existing && madeWithCurrentKey(existing) ? existing : null) ?? (await active.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  } catch (err) {
    // the person said no, or dismissed the prompt
    if ((await pushPermission()) !== "granted") return false;
    throw err;
  }
  const result = await savePushSubscriptionAction(toKeys(sub));
  if (!result.ok) {
    await sub.unsubscribe();
    throw new Error(result.error);
  }
  return true;
}

/* Turn push off for this device: the server's row first, while there's still
   a session to delete it with, then the browser's subscription. Signing out
   does this, so a shared device doesn't keep getting the last person's
   notifications. Never throws: signing out must go ahead regardless. */
export async function unsubscribeThisDevice(): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await deletePushSubscriptionAction(sub.endpoint);
    await sub.unsubscribe();
  } catch (err) {
    console.error("Couldn't turn off notifications for this device:", err);
  }
}
