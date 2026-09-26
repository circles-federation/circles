import { extendEventSeries } from "@/lib/db/events";

/* A repeating event's next date comes into range just by time passing, so a
   poller started at server boot (instrumentation.ts) tops every series up.
   Dates are made weeks ahead, so checking every few minutes is plenty; the
   database locks each series while it's extended, so two servers doing this
   at once can't add the same date twice. Like the notification poller, it
   doesn't hot-reload: restart `npm run dev` after changing series code. */

const POLL_MS = 10 * 60_000;

export function startSeriesWorker(): void {
  // globalThis, so dev-server module reloads don't stack up pollers
  const g = globalThis as typeof globalThis & { __seriesPoller?: NodeJS.Timeout };
  if (g.__seriesPoller) return;
  const tick = () => {
    extendEventSeries().catch((err) => console.error("Extending repeating events failed:", err));
  };
  g.__seriesPoller = setInterval(tick, POLL_MS);
  g.__seriesPoller.unref();
  tick();
}
