import {
  type PendingEventNotification,
  claimAnnouncementNotifications,
  claimDigests,
  claimEventNotifications,
  claimProposalNotifications,
  markProposalFailed,
  markProposalSent,
  enqueueReminders,
  markAnnouncementFailed,
  markAnnouncementSent,
  markDigestFailed,
  markDigestSent,
  markNotificationFailed,
  markNotificationSent,
} from "@/lib/db/notifications";
import { checkUnfilledSlots } from "@/lib/db/events";
import { stopTexting } from "@/lib/db/members";
import { closeDueProposals, withdrawLapsedEventProposals } from "@/lib/db/proposals";
import { deleteDeadSubscription, getSubscriptions, markSubscriptionUsed } from "@/lib/db/push";
import { sendEmail } from "@/lib/email";
import { ExpiredSubscriptionError, sendPush, type PushMessage } from "@/lib/push";
import { SmsOptedOutError, SmsUndeliverableError, sendSms } from "@/lib/sms";
import { digestText, textFromPush } from "@/lib/sms/messages.util";
import { announcementPush, digestPush, eventNotificationPush, proposalPush } from "@/lib/push/messages.util";
import { announcementEmail, eventChanges, eventDigestEmail, eventNotificationEmail, proposalEmail } from "@/lib/email/templates.util";
import { eventStartsAt } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { localDay } from "@/lib/recurrence.util";

/* Sends the queued event notifications, by email, push and text (see
   lib/db/notifications.ts for who's queued and why; each channel's rows are
   drained separately). Two things call drain: the create-event action, right after its
   response goes out — so members hear about a new event within a second or
   two — and a poller started at server boot (instrumentation.ts), which is the
   safety net for anything that failed, was left over from before a restart, or
   was queued by another server. The database decides which rows a given drain
   may take, so they never double-send. The poller also queues reminders as
   events come within a day of starting (enqueueReminders), and drains
   bulletin announcements' emails the same way (deliverAnnouncementNotifications).

   The daily digest (deliverDigests) rides the same poller: it isn't triggered
   by anything, it just becomes due once a day. */

const POLL_MS = 15_000;
const BATCH = 20;

// where a notification opens in the app. BETTER_AUTH_URL is this app's own
// public URL (Better Auth needs it too), so there's no second setting for it.
const appUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
const eventUrl = (id: string) => `${appUrl}/events/${id}`;
const circleUrl = (id: string) => `${appUrl}/circles/${id}`;

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

/* Push `message` to every device `memberId` has turned notifications on for.
   A device the push service says is gone is forgotten. It counts as delivered
   if any device took it, or if there's no device left to try; only when every
   device failed for some other reason (the service down, say) does it throw,
   so a queued notification is retried. Returns how many devices took it. */
export async function pushToMember(memberId: number, message: PushMessage): Promise<number> {
  const subscriptions = await getSubscriptions(memberId);
  let delivered = 0;
  let lastError: unknown;
  for (const sub of subscriptions) {
    try {
      await sendPush(sub, message);
      await markSubscriptionUsed(sub.endpoint);
      delivered++;
    } catch (err) {
      if (err instanceof ExpiredSubscriptionError) await deleteDeadSubscription(sub.endpoint);
      else lastError = err;
    }
  }
  if (delivered === 0 && lastError !== undefined) throw lastError;
  return delivered;
}

/* Text `body` to a member's number. Someone who's replied STOP can't be
   texted until they reply START, and a number that can't take texts never
   will, so either turns their texts off (stopTexting) and counts as done
   rather than being retried; anything else throws, to be retried. Returns
   whether it went. */
export async function textMember(memberId: number, phone: string, body: string): Promise<boolean> {
  try {
    await sendSms({ to: phone, body });
    return true;
  } catch (err) {
    if (!(err instanceof SmsOptedOutError || err instanceof SmsUndeliverableError)) throw err;
    console.error(`Turning texts off for member ${memberId}:`, err.message);
    await stopTexting(memberId, { stopped: err instanceof SmsOptedOutError });
    return false;
  }
}

let digesting = false;

/* Wraps one pass over a queue so only one runs at a time per process: a call
   that lands mid-drain asks it to look once more instead of being dropped. */
function drainer(name: string, drainOnce: () => Promise<void>): () => Promise<void> {
  let running = false;
  let again = false;
  return async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await drainOnce();
      } while (again);
    } catch (err) {
      console.error(`${name} drain failed:`, err);
    } finally {
      running = false;
    }
  };
}

// an event notification with nothing left to say: edited and then put back
// before it went out, a reminder or short-slot warning that's been retrying
// past the start, too late to help, or a warning whose slots have been
// filled since it was queued
const isMoot = (n: PendingEventNotification) =>
  (n.notice === "updated" && !Object.values(eventChanges(n)).some(Boolean)) ||
  ((n.notice === "reminder" || n.notice === "short") && eventStartsAt(n) <= new Date()) ||
  (n.notice === "short" && (n.openSlots ?? []).length === 0);

const deliverEventEmails = drainer("Event email", async () => {
  for (let batch = await claimEventNotifications(BATCH, "email"); batch.length > 0; batch = await claimEventNotifications(BATCH, "email")) {
    for (const n of batch) {
      // nor can anyone be emailed who's since removed their address
      if (!n.email || isMoot(n)) {
        await markNotificationSent(n);
        continue;
      }
      try {
        await sendEmail({ to: n.email, ...eventNotificationEmail({ ...n, url: eventUrl(n.eventId), today: localDay() }) });
        await markNotificationSent(n);
      } catch (err) {
        console.error(`Couldn't email event ${n.eventId} to member ${n.memberId}:`, err);
        await markNotificationFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const deliverEventPushes = drainer("Event push", async () => {
  for (let batch = await claimEventNotifications(BATCH, "push"); batch.length > 0; batch = await claimEventNotifications(BATCH, "push")) {
    for (const n of batch) {
      if (isMoot(n)) {
        await markNotificationSent(n);
        continue;
      }
      try {
        await pushToMember(n.memberId, eventNotificationPush({ ...n, today: localDay() }));
        await markNotificationSent(n);
      } catch (err) {
        console.error(`Couldn't push event ${n.eventId} to member ${n.memberId}:`, err);
        await markNotificationFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const deliverEventTexts = drainer("Event text", async () => {
  for (let batch = await claimEventNotifications(BATCH, "sms"); batch.length > 0; batch = await claimEventNotifications(BATCH, "sms")) {
    for (const n of batch) {
      // nor can anyone be texted who's since removed their number or turned texts off
      if (!n.phone || isMoot(n)) {
        await markNotificationSent(n);
        continue;
      }
      try {
        await textMember(n.memberId, n.phone, textFromPush(eventNotificationPush({ ...n, today: localDay() }), appUrl));
        await markNotificationSent(n);
      } catch (err) {
        console.error(`Couldn't text event ${n.eventId} to member ${n.memberId}:`, err);
        await markNotificationFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

// every channel side by side, so a slow mail relay never holds up a push or a text
export async function deliverEventNotifications(): Promise<void> {
  await Promise.all([deliverEventEmails(), deliverEventPushes(), deliverEventTexts()]);
}

const deliverAnnouncementEmails = drainer("Announcement email", async () => {
  for (let batch = await claimAnnouncementNotifications(BATCH, "email"); batch.length > 0; batch = await claimAnnouncementNotifications(BATCH, "email")) {
    for (const n of batch) {
      if (!n.email) {
        await markAnnouncementSent(n);
        continue;
      }
      try {
        await sendEmail({ to: n.email, ...announcementEmail({ ...n, url: circleUrl(n.circleId) }) });
        await markAnnouncementSent(n);
      } catch (err) {
        console.error(`Couldn't email announcement ${n.resourceId} to member ${n.memberId}:`, err);
        await markAnnouncementFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const deliverAnnouncementPushes = drainer("Announcement push", async () => {
  for (let batch = await claimAnnouncementNotifications(BATCH, "push"); batch.length > 0; batch = await claimAnnouncementNotifications(BATCH, "push")) {
    for (const n of batch) {
      try {
        await pushToMember(n.memberId, announcementPush(n));
        await markAnnouncementSent(n);
      } catch (err) {
        console.error(`Couldn't push announcement ${n.resourceId} to member ${n.memberId}:`, err);
        await markAnnouncementFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const deliverAnnouncementTexts = drainer("Announcement text", async () => {
  for (let batch = await claimAnnouncementNotifications(BATCH, "sms"); batch.length > 0; batch = await claimAnnouncementNotifications(BATCH, "sms")) {
    for (const n of batch) {
      if (!n.phone) {
        await markAnnouncementSent(n);
        continue;
      }
      try {
        await textMember(n.memberId, n.phone, textFromPush(announcementPush(n), appUrl));
        await markAnnouncementSent(n);
      } catch (err) {
        console.error(`Couldn't text announcement ${n.resourceId} to member ${n.memberId}:`, err);
        await markAnnouncementFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const proposalUrl = (id: string) => `${appUrl}/proposals/${id}`;

const deliverProposalEmails = drainer("Proposal email", async () => {
  for (let batch = await claimProposalNotifications(BATCH, "email"); batch.length > 0; batch = await claimProposalNotifications(BATCH, "email")) {
    for (const n of batch) {
      if (!n.email) {
        await markProposalSent(n);
        continue;
      }
      try {
        await sendEmail({ to: n.email, ...proposalEmail({ ...n, url: proposalUrl(n.proposalId) }) });
        await markProposalSent(n);
      } catch (err) {
        console.error(`Couldn't email proposal ${n.proposalId} to member ${n.memberId}:`, err);
        await markProposalFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const deliverProposalPushes = drainer("Proposal push", async () => {
  for (let batch = await claimProposalNotifications(BATCH, "push"); batch.length > 0; batch = await claimProposalNotifications(BATCH, "push")) {
    for (const n of batch) {
      try {
        await pushToMember(n.memberId, proposalPush(n));
        await markProposalSent(n);
      } catch (err) {
        console.error(`Couldn't push proposal ${n.proposalId} to member ${n.memberId}:`, err);
        await markProposalFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

const deliverProposalTexts = drainer("Proposal text", async () => {
  for (let batch = await claimProposalNotifications(BATCH, "sms"); batch.length > 0; batch = await claimProposalNotifications(BATCH, "sms")) {
    for (const n of batch) {
      if (!n.phone) {
        await markProposalSent(n);
        continue;
      }
      try {
        await textMember(n.memberId, n.phone, textFromPush(proposalPush(n), appUrl));
        await markProposalSent(n);
      } catch (err) {
        console.error(`Couldn't text proposal ${n.proposalId} to member ${n.memberId}:`, err);
        await markProposalFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

// a proposal's news (opened, objected, passed): called right after an action
// that earns some, and by the poller, which also passes proposals whose
// window has ended
export async function deliverProposalNotifications(): Promise<void> {
  await Promise.all([deliverProposalEmails(), deliverProposalPushes(), deliverProposalTexts()]);
}

async function closeThenDeliverProposals(): Promise<void> {
  try {
    // first, so an event that's begun undecided isn't then scheduled
    await withdrawLapsedEventProposals();
    await closeDueProposals();
  } catch (err) {
    console.error("Closing due proposals failed:", err);
  }
  await deliverProposalNotifications();
}

// deliverEventNotifications' counterpart for bulletin announcements: called
// right after one is posted, and by the poller as the safety net
export async function deliverAnnouncementNotifications(): Promise<void> {
  await Promise.all([deliverAnnouncementEmails(), deliverAnnouncementPushes(), deliverAnnouncementTexts()]);
}

export async function deliverDigests(now: Date = new Date()): Promise<void> {
  if (digesting) return;
  digesting = true;
  try {
    const cutoff = digestCutoff(now);
    // by email and by text, each member's rows on each claimed separately
    for (const channel of ["email", "sms"] as const) {
      for (let batch = await claimDigests(cutoff, BATCH, channel); batch.length > 0; batch = await claimDigests(cutoff, BATCH, channel)) {
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
          if (!digest.address || upcoming.length === 0) {
            await markDigestSent(digest.keys);
            continue;
          }
          const withUrls = upcoming.map((e) => ({ ...e, url: eventUrl(e.id) }));
          try {
            if (channel === "sms") {
              await textMember(digest.memberId, digest.address, digestText(withUrls, appUrl));
              await markDigestSent(digest.keys);
              continue;
            }
            await sendEmail({ to: digest.address, ...eventDigestEmail(withUrls) });
            await markDigestSent(digest.keys);
            // a nudge toward the email just sent, on whatever devices have push
            // on; best effort, since a late nudge would point at old news
            await pushToMember(digest.memberId, digestPush()).catch((err) => console.error(`Couldn't push the digest nudge to member ${digest.memberId}:`, err));
          } catch (err) {
            console.error(`Couldn't ${channel === "sms" ? "text" : "email"} the digest to member ${digest.memberId}:`, err);
            await markDigestFailed(digest.keys, err instanceof Error ? err.message : String(err));
          }
        }
      }
    }
  } catch (err) {
    console.error("Digest delivery failed:", err);
  } finally {
    digesting = false;
  }
}

// queue reminders for whatever has come within a day of starting, warn
// hosts of slots still short within the hour (and cancel what's still short
// at 15 minutes), then send all that along with anything else waiting
async function remindThenDeliver(): Promise<void> {
  try {
    await enqueueReminders();
  } catch (err) {
    console.error("Queueing event reminders failed:", err);
  }
  try {
    await checkUnfilledSlots();
  } catch (err) {
    console.error("Checking for unfilled slots failed:", err);
  }
  await deliverEventNotifications();
}

export function startNotificationWorker(): void {
  // globalThis, so dev-server module reloads don't stack up pollers
  const g = globalThis as typeof globalThis & { __notificationPoller?: NodeJS.Timeout };
  if (g.__notificationPoller) return;
  const tick = () => {
    void remindThenDeliver();
    void deliverAnnouncementNotifications();
    void closeThenDeliverProposals();
    void deliverDigests();
  };
  g.__notificationPoller = setInterval(tick, POLL_MS);
  g.__notificationPoller.unref();
  tick();
}
