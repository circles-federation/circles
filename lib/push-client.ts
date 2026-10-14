import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/db/actions";
import type { PushSubscriptionKeys } from "@/lib/push";

/* The browser's side of push notifications (the server's is lib/push/ and
   lib/notify.ts): registering public/sw.js, and turning push on or off for
   this device. Browser-only, so call it from effects and taps. */

export const SERVICE_WORKER_URL = "/sw.js";

// Home asks once per device whether to turn push on (PushPrompt): answered
// either way there, or by turning it on or off in Settings, it isn't asked
// again. Kept in this browser's storage, since push is per device too; storage
// can be unavailable or cleared, which at worst means asking once more.
const PUSH_PROMPT_KEY = "circles.pushPromptAnswered";
export function pushPromptAnswered(): boolean {
  try {
    return localStorage.getItem(PUSH_PROMPT_KEY) !== null;
  } catch {
    return false;
  }
}
export function markPushPromptAnswered(): void {
  try {
    localStorage.setItem(PUSH_PROMPT_KEY, new Date().toISOString());
  } catch {
    // nowhere to remember it: it may be asked once more
  }
}

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
   browser that rotated it, and moves it to whoever is signed in now. Run once
   when the app opens (AppShell). */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  if (!("PushManager" in window)) return;
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    const result = await savePushSubscriptionAction(toKeys(sub));
    if (!result.ok) console.error(result.error);
  }
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
    sub = (await active.pushManager.getSubscription()) ?? (await active.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
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
