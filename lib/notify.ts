import { claimEventNotifications, markNotificationFailed, markNotificationSent } from "@/lib/db/notifications";
import { sendEmail } from "@/lib/email";
import { eventNotificationEmail } from "@/lib/email/templates.util";

/* Sends the queued event emails (see lib/db/notifications.ts for who's queued
   and why). Two things call drain: the create-event action, right after its
   response goes out — so members hear about a new event within a second or
   two — and a poller started at server boot (instrumentation.ts), which is the
   safety net for anything that failed, was left over from before a restart, or
   was queued by another server. The database decides which rows a given drain
   may take, so they never double-send. */

const POLL_MS = 15_000;
const BATCH = 20;

// where a notification opens in the app. BETTER_AUTH_URL is this app's own
// public URL (Better Auth needs it too), so there's no second setting for it.
const eventUrl = (id: string) => `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/events/${id}`;

let draining = false;
let drainAgain = false;

export async function deliverEventNotifications(): Promise<void> {
  // one drain at a time per process; a call that lands mid-drain asks it to
  // look once more instead of being dropped
  if (draining) {
    drainAgain = true;
    return;
  }
  draining = true;
  try {
    do {
      drainAgain = false;
      for (let batch = await claimEventNotifications(BATCH); batch.length > 0; batch = await claimEventNotifications(BATCH)) {
        for (const n of batch) {
          try {
            await sendEmail({ to: n.email, ...eventNotificationEmail({ ...n, url: eventUrl(n.eventId) }) });
            await markNotificationSent(n.eventId, n.memberId);
          } catch (err) {
            console.error(`Couldn't email event ${n.eventId} to member ${n.memberId}:`, err);
            await markNotificationFailed(n.eventId, n.memberId, err instanceof Error ? err.message : String(err));
          }
        }
      }
    } while (drainAgain);
  } catch (err) {
    console.error("Event notification drain failed:", err);
  } finally {
    draining = false;
  }
}

export function startNotificationWorker(): void {
  // globalThis, so dev-server module reloads don't stack up pollers
  const g = globalThis as typeof globalThis & { __notificationPoller?: NodeJS.Timeout };
  if (g.__notificationPoller) return;
  g.__notificationPoller = setInterval(() => void deliverEventNotifications(), POLL_MS);
  g.__notificationPoller.unref();
  void deliverEventNotifications();
}
