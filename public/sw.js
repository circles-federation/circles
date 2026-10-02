/* Circles' service worker. It's here only for push notifications, so it has
   no fetch handler on purpose: it never caches or serves a page, which would
   fight the reload-after-deploy check in lib/app-version.ts. Offline support
   would be a separate decision.

   Plain JavaScript, since public/ isn't compiled. The server's side is
   lib/push/index.ts; the message it sends is { title, body, url, tag }. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // not ours to read, but a push must still show something (iOS revokes
    // the subscription of an app whose pushes show nothing)
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Circles", {
      body: message.body || "",
      tag: message.tag,
      icon: "/icons/icon-192.png",
      // Android's status bar, drawn from transparency alone (npm run icons)
      badge: "/icons/badge-96.png",
      data: { url: message.url || "/home" },
    })
  );
});

// open what the notification is about: in a Circles window that's already
// open if there is one (the app navigates itself, see AppShell, so nothing is
// reloaded), otherwise in a new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname + url.search + url.hash;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: "open", path });
      } else {
        await self.clients.openWindow(path);
      }
    })()
  );
});
