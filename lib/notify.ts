import { claimDigests, claimEventNotifications, markDigestFailed, markDigestSent, markNotificationFailed, markNotificationSent } from "@/lib/db/notifications";
import { sendEmail } from "@/lib/email";
import { eventDigestEmail, eventNotificationEmail } from "@/lib/email/templates.util";
import { isPastEvent } from "@/lib/format.util";

/* Sends the queued event emails (see lib/db/notifications.ts for who's queued
   and why). Two things call drain: the create-event action, right after its
   response goes out — so members hear about a new event within a second or
   two — and a poller started at server boot (instrumentation.ts), which is the
   safety net for anything that failed, was left over from before a restart, or
   was queued by another server. The database decides which rows a given drain
   may take, so they never double-send.

   The daily digest (deliverDigests) rides the same poller: it isn't triggered
   by anything, it just becomes due once a day. */

const POLL_MS = 15_000;
const BATCH = 20;

// where a notification opens in the app. BETTER_AUTH_URL is this app's own
// public URL (Better Auth needs it too), so there's no second setting for it.
const eventUrl = (id: string) => `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/events/${id}`;

// The digest goes out once a day at DIGEST_HOUR (0-23, this server's local
// time — set TZ for a server that isn't in the community's timezone). Rows
// queued since the previous send time are due; ones queued after this
// morning's wait for tomorrow's. There's no "did today's run happen" record to
// keep: due rows are marked sent as they go, so the next tick finds none.
function digestHour(): number {
  const h = Math.floor(Number(process.env.DIGEST_HOUR ?? 8));
  return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 8;
}

// the most recent daily send time at or before `now`
export function digestCutoff(now: Date, hour = digestHour()): Date {
  const cutoff = new Date(now);
  cutoff.setHours(hour, 0, 0, 0);
  if (cutoff > now) cutoff.setDate(cutoff.getDate() - 1);
  return cutoff;
}

let draining = false;
let digesting = false;
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
            await markNotificationSent(n);
          } catch (err) {
            console.error(`Couldn't email event ${n.eventId} to member ${n.memberId}:`, err);
            await markNotificationFailed(n, err instanceof Error ? err.message : String(err));
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

export async function deliverDigests(now: Date = new Date()): Promise<void> {
  if (digesting) return;
  digesting = true;
  try {
    const cutoff = digestCutoff(now);
    for (let batch = await claimDigests(cutoff, BATCH); batch.length > 0; batch = await claimDigests(cutoff, BATCH)) {
      for (const digest of batch) {
        // by the time it's due an event may already be over — skip those, and
        // send nothing at all if that leaves nothing to say
        // one line per event — a meeting that was proposed and then approved
        // since the last digest is listed once, as approved
        const byEvent = new Map<string, (typeof digest.events)[number]>();
        for (const e of digest.events.filter((e) => !isPastEvent(e))) {
          if (!byEvent.has(e.id) || e.notice === "approved") byEvent.set(e.id, e);
        }
        const upcoming = [...byEvent.values()];
        if (!digest.email || upcoming.length === 0) {
          await markDigestSent(digest.keys);
          continue;
        }
        try {
          await sendEmail({ to: digest.email, ...eventDigestEmail(upcoming.map((e) => ({ ...e, url: eventUrl(e.id) }))) });
          await markDigestSent(digest.keys);
        } catch (err) {
          console.error(`Couldn't email the digest to member ${digest.memberId}:`, err);
          await markDigestFailed(digest.keys, err instanceof Error ? err.message : String(err));
        }
      }
    }
  } catch (err) {
    console.error("Digest delivery failed:", err);
  } finally {
    digesting = false;
  }
}

export function startNotificationWorker(): void {
  // globalThis, so dev-server module reloads don't stack up pollers
  const g = globalThis as typeof globalThis & { __notificationPoller?: NodeJS.Timeout };
  if (g.__notificationPoller) return;
  const tick = () => {
    void deliverEventNotifications();
    void deliverDigests();
  };
  g.__notificationPoller = setInterval(tick, POLL_MS);
  g.__notificationPoller.unref();
  tick();
}
