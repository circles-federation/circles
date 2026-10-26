import { randomBytes } from "node:crypto";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { getEvent, getVisibleEvent, memberManagesEvent } from "./events";
import { confirmedGuestNames } from "./guest-rsvps";
import { circles, eventShareLinks, members } from "./schema";
import { hasEnded } from "@/lib/events.util";
import { awaitingConsent, isMeeting } from "@/lib/governance.util";
import type { SharedEvent } from "@/lib/types";

/* A member shares an event with someone who has no account by sending them
   its public page, /e/[token]. The token is the page's whole address, one per
   (event, sharer) so the application that may follow can say who invited them.
   Making one needs only that the member can see the event; what the public
   page then shows is decided here, in getSharedEvent, and is a deliberately
   short list: nothing in it can be traced to a member's profile, photo or
   email. The circles it's for and hosted by are named, a group's included:
   whoever holds the link has been told of the event by one of its members. */

export class ShareError extends UserFacingError {}

async function findLink(memberId: number, eventId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: eventShareLinks.token })
    .from(eventShareLinks)
    .where(and(eq(eventShareLinks.eventId, eventId), eq(eventShareLinks.memberId, memberId), isNull(eventShareLinks.revokedAt)));
  return row?.token ?? null;
}

// the token for this member's live link to the event, made on first use (and
// again after they've stopped the last one)
export async function getOrCreateShareToken(memberId: number, eventId: string): Promise<string> {
  const event = await getVisibleEvent(memberId, eventId);
  if (!event) throw new ShareError("That event doesn't exist.");
  // a meeting is its circle's own business, and an undecided event may never be held
  if (isMeeting(event)) throw new ShareError("A meeting can't be shared outside Circles.");
  if (awaitingConsent(event)) throw new ShareError("This can be shared once its circle has consented to it.");
  if (event.cancelled) throw new ShareError("This event has been cancelled.");
  if (hasEnded(event)) throw new ShareError("This event is over.");

  const existing = await findLink(memberId, eventId);
  if (existing) return existing;

  const token = randomBytes(16).toString("base64url");
  // two taps at once: the second finds the first's link
  await db.insert(eventShareLinks).values({ token, eventId, memberId }).onConflictDoNothing();
  const made = await findLink(memberId, eventId);
  if (!made) throw new ShareError("Couldn't make a link — try again.");
  return made;
}

// what a stranger holding the link may see, or null for a token that isn't
// one, or whose event is no longer one to share
export async function getSharedEvent(token: string): Promise<SharedEvent | null> {
  const [link] = await db.select().from(eventShareLinks).where(and(eq(eventShareLinks.token, token), isNull(eventShareLinks.revokedAt)));
  if (!link) return null;
  const event = await getEvent(link.eventId);
  if (!event || isMeeting(event) || awaitingConsent(event)) return null;

  const circleIds = [event.circleId, ...(event.hostCircleId ? [event.hostCircleId] : [])];
  const circleRows = await db.select({ id: circles.id, name: circles.name }).from(circles).where(inArray(circles.id, circleIds));
  const nameOf = (id: string | undefined) => circleRows.find((r) => r.id === id)?.name ?? null;

  const memberIds = [...new Set([link.memberId, event.organizerId, ...event.rsvps])];
  const names = new Map((await db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, memberIds))).map((m) => [m.id, m.name]));

  return {
    title: event.title,
    date: event.date,
    start: event.start,
    end: event.end,
    location: event.location,
    description: event.description,
    cancelled: !!event.cancelled,
    ended: hasEnded(event),
    hasRoles: (event.roles ?? []).length > 0,
    token,
    circleName: nameOf(event.circleId),
    hostCircleName: nameOf(event.hostCircleId),
    hostName: names.get(event.organizerId) ?? "A neighbor",
    sharedBy: names.get(link.memberId) ?? "A neighbor",
    going: [...event.rsvps.flatMap((id) => names.get(id) ?? []), ...(await confirmedGuestNames(event.id))],
    eventId: event.id,
  };
}

export interface ShareStatus {
  // they have a live link of their own
  mine: boolean;
  // they manage the event, so may stop every link to it
  canRevokeAll: boolean;
  // someone else has a live link too (only said to a manager)
  othersLive: boolean;
}

export async function getShareStatus(memberId: number, eventId: string): Promise<ShareStatus> {
  if (!(await getVisibleEvent(memberId, eventId))) throw new ShareError("That event doesn't exist.");
  const canRevokeAll = await memberManagesEvent(memberId, eventId);
  const [others] = canRevokeAll
    ? await db
        .select({ n: count() })
        .from(eventShareLinks)
        .where(and(eq(eventShareLinks.eventId, eventId), isNull(eventShareLinks.revokedAt), sql`${eventShareLinks.memberId} <> ${memberId}`))
    : [];
  return { mine: (await findLink(memberId, eventId)) !== null, canRevokeAll, othersLive: (others?.n ?? 0) > 0 };
}

/* Stop sharing: the sharer's own link ("mine"), or, for whoever manages the
   event (its organizer, or any member of its host circle: memberManagesEvent),
   every link to it ("all"). A stopped link opens nothing and takes no new
   RSVPs, but the guests who already RSVPed through it stay on the list and keep
   their emails: stopping is about letting no one else in. Returns how many
   links it stopped. */
export async function revokeShareLinks(memberId: number, eventId: string, scope: "mine" | "all"): Promise<number> {
  if (scope === "all" && !(await memberManagesEvent(memberId, eventId))) throw new ShareError("Only whoever manages this event can stop every link to it.");
  const mine = and(eq(eventShareLinks.eventId, eventId), eq(eventShareLinks.memberId, memberId));
  const rows = await db
    .update(eventShareLinks)
    .set({ revokedAt: new Date() })
    .where(and(scope === "all" ? eq(eventShareLinks.eventId, eventId) : mine, isNull(eventShareLinks.revokedAt)))
    .returning({ token: eventShareLinks.token });
  return rows.length;
}
