import { isInstalledApp } from "./viewport";

/* Installing the app from a browser tab, where the browser offers it.
   Chromium browsers (Chrome, Edge, Android) fire beforeinstallprompt once the
   page qualifies; holding on to it is what lets Home's install prompt
   install with a tap rather than send someone hunting through menus. It can
   fire before any of the app's code has loaded, so the root layout's inline
   script holds one that early, and this module takes it over when it loads
   (AppShell imports it). Browser-only: in render, read it through
   useSyncExternalStore with subscribeInstall. */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  // one that came before this module loaded, held by the root layout's script
  deferred = (window as Window & { __installOffer?: BeforeInstallPromptEvent }).__installOffer ?? null;
  window.addEventListener("beforeinstallprompt", (e) => {
    // our own prompt offers it instead of the browser's mini-infobar
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function subscribeInstall(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

// whether the browser will install it with a tap, right now
export function canInstallNatively(): boolean {
  return !installed && deferred !== null && !isInstalledApp();
}

/* Shows the browser's own install prompt. Its event can only be used once,
   so it's let go either way; the browser fires a new one if it'll offer
   again. */
export async function installNatively(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
}
