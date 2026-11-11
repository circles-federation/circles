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
import { purgeGuestData } from "@/lib/db/guest-rsvps";
import { purgeGuestMessageDrafts } from "@/lib/db/guest-messages";
import { getChatNoticeData } from "@/lib/db/chat";
import { chatHub } from "@/lib/db/chat-stream";
import { getMessageNoticeData } from "@/lib/db/messages";
import { claimGuestNotifications, markGuestFailed, markGuestSent } from "@/lib/db/guest-notifications";
import { checkUnfilledSlots } from "@/lib/db/events";
import { finishLapsedMeetings } from "@/lib/db/meeting-sessions";
import { closeDueProposals, withdrawLapsedEventProposals } from "@/lib/db/proposals";
import { deleteDeadSubscription, getSubscriptions, markSubscriptionUsed } from "@/lib/db/push";
import { sendEmail } from "@/lib/email";
import { ExpiredSubscriptionError, sendPush, type PushMessage } from "@/lib/push";
import { announcementPush, chatPush, circleMessagePush, digestPush, eventNotificationPush, proposalPush } from "@/lib/push/messages.util";
import { announcementEmail, circleMessageEmail, digestEmail, eventChanges, eventNotificationEmail, guestEmail, proposalEmail } from "@/lib/email/templates.util";
import { eventStartsAt, isReminder } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { localDay } from "@/lib/recurrence.util";

/* Sends the queued event notifications, by email and by push (see
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
  ((isReminder(n.notice) || n.notice === "short") && eventStartsAt(n) <= new Date()) ||
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

// what a guest who RSVPed from a share link is owed: it opens their share
// page, where the event can be seen again. Dropped unsent when it's no longer
// true: an edit put back as it was, a confirmation for an event now over or
// called off (its cancellation says so).
const deliverGuestEmails = drainer("Guest email", async () => {
  for (let batch = await claimGuestNotifications(BATCH); batch.length > 0; batch = await claimGuestNotifications(BATCH)) {
    for (const n of batch) {
      const moot =
        (n.notice === "updated" && !Object.values(eventChanges(n)).some(Boolean)) ||
        (n.notice === "confirmed" && (n.cancelled || eventStartsAt(n) <= new Date()));
      if (moot) {
        await markGuestSent(n);
        continue;
      }
      try {
        const stopUrl = `${appUrl}/e/stop/${n.guestId}`;
        await sendEmail({
          to: n.email,
          ...guestEmail({ ...n, url: n.shareToken ? `${appUrl}/e/${n.shareToken}` : stopUrl, unsubscribeUrl: stopUrl }),
          headers: { "List-Unsubscribe": `<${stopUrl}>` },
        });
        await markGuestSent(n);
      } catch (err) {
        console.error(`Couldn't email event ${n.eventId} to guest ${n.guestId}:`, err);
        await markGuestFailed(n, err instanceof Error ? err.message : String(err));
      }
    }
  }
});

// both channels side by side, so a slow mail relay never holds up a push; a
// guest's email goes with them
export async function deliverEventNotifications(): Promise<void> {
  await Promise.all([deliverEventEmails(), deliverEventPushes(), deliverGuestEmails()]);
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

// a proposal's news (opened, objected, passed): called right after an action
// that earns some, and by the poller, which also passes proposals whose
// window has ended
export async function deliverProposalNotifications(): Promise<void> {
  await Promise.all([deliverProposalEmails(), deliverProposalPushes()]);
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
  await Promise.all([deliverAnnouncementEmails(), deliverAnnouncementPushes()]);
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
        // and the neighborhood's news: posts still up, proposals still open
        // (claimDigests leaves out the rest)
        const { posts, proposals } = digest;
        if (!digest.email || upcoming.length + posts.length + proposals.length === 0) {
          await markDigestSent(digest);
          continue;
        }
        try {
          await sendEmail({
            to: digest.email,
            ...digestEmail({
              events: upcoming.map((e) => ({ ...e, url: eventUrl(e.id) })),
              posts: posts.map(({ neighborhoodId, ...p }) => ({ ...p, pageUrl: `${appUrl}/circles/${neighborhoodId}` })),
              proposals: proposals.map(({ id, ...p }) => ({ ...p, url: `${appUrl}/proposals/${id}` })),
            }),
          });
          await markDigestSent(digest);
          // a nudge toward the email just sent, on whatever devices have push
          // on; best effort, since a late nudge would point at old news
          await pushToMember(digest.memberId, digestPush()).catch((err) => console.error(`Couldn't push the digest nudge to member ${digest.memberId}:`, err));
        } catch (err) {
          console.error(`Couldn't email the digest to member ${digest.memberId}:`, err);
          await markDigestFailed(digest, err instanceof Error ? err.message : String(err));
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
  let lastPurge = 0;
  const tick = () => {
    // an hour apart: what's purged only goes stale by the day
    if (Date.now() - lastPurge >= 3_600_000) {
      lastPurge = Date.now();
      void purgeGuestData().catch((err) => console.error("Purging old guest data failed:", err));
      void purgeGuestMessageDrafts().catch((err) => console.error("Purging unconfirmed guest messages failed:", err));
      void finishLapsedMeetings().catch((err) => console.error("Finishing lapsed meetings failed:", err));
    }
    void remindThenDeliver();
    void deliverAnnouncementNotifications();
    void closeThenDeliverProposals();
    void deliverDigests();
  };
  g.__notificationPoller = setInterval(tick, POLL_MS);
  g.__notificationPoller.unref();
  tick();
}

/* A new message to a circle's Inbox, from a member or a guest: its members
   but its sender are told once, by email and push, right after the response
   that sent it; a failed send isn't retried, since it waits in the Inbox. */
export async function tellCircleOfMessage(id: string) {
  const data = await getMessageNoticeData(id).catch((err) => {
    console.error("Couldn't read a message to tell its circle of:", err);
    return null;
  });
  if (!data) return;
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/circles/${data.circleId}/inbox/${id}`;
  await Promise.all(
    data.recipients.flatMap((r) => [
      r.email && sendEmail({ to: r.email, ...circleMessageEmail({ ...data, name: r.name, url }) }).catch((err) => console.error("Couldn't email a circle of a message:", err)),
      pushToMember(r.memberId, circleMessagePush({ ...data, messageId: id })).catch((err) => console.error("Couldn't push a circle a message:", err)),
    ]),
  );
}

/* A new message in a circle's chat: told by push only (an email per message
   would be unusable, and a message is already waiting in the thread), right
   after the response that sent it; a failed push isn't retried. A message that
   tags people tells only them, and one that doesn't tells the whole circle.
   Anyone already reading the thread on screen is skipped. */
export async function tellCircleOfChat(id: number) {
  const data = await getChatNoticeData(id).catch((err) => {
    console.error("Couldn't read a chat message to tell its circle of:", err);
    return null;
  });
  if (!data) return;
  const message = chatPush(data);
  await Promise.all(
    data.recipientIds
      .filter((memberId) => !chatHub.isViewing(memberId, data.circleId))
      .map((memberId) => pushToMember(memberId, message).catch((err) => console.error("Couldn't push a chat message:", err))),
  );
}
