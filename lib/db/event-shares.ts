import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { getEvent, getVisibleEvent } from "./events";
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
   email, and a group's name is never given out. */

export class ShareError extends UserFacingError {}

async function findLink(memberId: number, eventId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: eventShareLinks.token })
    .from(eventShareLinks)
    .where(and(eq(eventShareLinks.eventId, eventId), eq(eventShareLinks.memberId, memberId)));
  return row?.token ?? null;
}

// the token for this member's link to the event, made on first use
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
  const [link] = await db.select().from(eventShareLinks).where(eq(eventShareLinks.token, token));
  if (!link) return null;
  const event = await getEvent(link.eventId);
  if (!event || isMeeting(event) || awaitingConsent(event)) return null;

  const circleIds = [event.circleId, ...(event.hostCircleId ? [event.hostCircleId] : [])];
  const circleRows = await db.select({ id: circles.id, name: circles.name, type: circles.type }).from(circles).where(inArray(circles.id, circleIds));
  const publicName = (id: string | undefined) => {
    const c = circleRows.find((r) => r.id === id);
    return c && c.type !== "group" ? c.name : null;
  };

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
    circleName: publicName(event.circleId),
    hostCircleName: publicName(event.hostCircleId),
    hostName: names.get(event.organizerId) ?? "A neighbor",
    sharedBy: names.get(link.memberId) ?? "A neighbor",
    going: [...event.rsvps.flatMap((id) => names.get(id) ?? []), ...(await confirmedGuestNames(event.id))],
    eventId: event.id,
  };
}
