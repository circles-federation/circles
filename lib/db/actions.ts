"use server";

import { after } from "next/server";
import * as applications from "./applications";
import { getAppStateForMember, type AppStateData } from "./app-state";
import * as circleRoles from "./circle-roles";
import * as circles from "./circles";
import { UserFacingError } from "./errors";
import * as events from "./events";
import * as members from "./members";
import * as resources from "./resources";
import { sendEmail } from "@/lib/email";
import { applicationApprovedEmail, applicationDeclinedEmail } from "@/lib/email/templates.util";
import { deliverEventNotifications } from "@/lib/notify";
import { getCurrentUserId } from "@/lib/session";
import type { CircleRoleDraft } from "@/lib/circle-roles.util";
import type { EventDetails, EventDraft, SeriesScope } from "@/lib/events.util";
import type { ResourceInput } from "@/lib/resources.util";
import type { Circle, Member } from "@/lib/types";

/* AppStateProvider is a Client Component and can't hold a real DB
   connection — Drizzle's Postgres driver is Node-only. These thin wrappers
   are the boundary it calls through instead, the same "use server" pattern
   lib/auth.ts already uses. Reads don't need this: app/(app)/layout.tsx is
   already a Server Component and imports lib/db/*.ts directly. */

/* Both authorized against the session like every other write below —
   updateMemberAction never takes an id at all, so there's no id a caller
   could substitute someone else's for; updateCircleAction requires the
   session member to belong to the circle (lib/db/circles.ts). */
export async function updateMemberAction(patch: Partial<Member>) {
  return asMember((memberId) => members.updateMember(memberId, patch));
}

// like updateMemberAction, always the session member's own photo; the file
// comes as FormData since that's how a Server Action takes a Blob
export async function updateMemberPhotoAction(form: FormData) {
  const photo = form.get("photo");
  return asMember((memberId) => members.setMemberPhoto(memberId, photo instanceof Blob ? photo : new Blob()));
}

// AppStateProvider's refresh when the app returns to the foreground: the same
// data the (app) layout loaded, fresh. A lapsed session says so, so the app
// can send them to sign in again rather than keep showing what it had.
export async function loadAppStateAction(): Promise<{ ok: true; value: AppStateData } | { ok: false; signedOut: boolean }> {
  const memberId = await getCurrentUserId();
  const state = memberId ? await getAppStateForMember(memberId) : null;
  return state ? { ok: true, value: state } : { ok: false, signedOut: true };
}

export async function updateCircleAction(id: string, patch: Partial<Circle>) {
  return asMember((memberId) => circles.updateCircle(memberId, id, patch));
}


/* Resource and event writes are authorized on the server: they act as the
   signed-in member from the session (never a client-supplied id), and
   lib/db/resources.ts / lib/db/events.ts check that member's right to do it.
   They return a result object instead of throwing — Next sanitizes a thrown
   error's message in production, so the caller couldn't show why it was
   refused (same shape lib/auth.ts's actions use). */
async function asMember<T>(run: (memberId: number) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const memberId = await getCurrentUserId();
  if (!memberId) return { ok: false, error: "Sign in again to do that." };
  try {
    return { ok: true, value: await run(memberId) };
  } catch (err) {
    if (err instanceof UserFacingError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong — try again." };
  }
}

export async function saveCircleRolesAction(circleId: string, drafts: CircleRoleDraft[]) {
  return asMember((memberId) => circleRoles.setCircleRoles(memberId, circleId, drafts));
}

export async function createResourceAction(circleId: string, input: ResourceInput) {
  return asMember((memberId) => resources.createResource(memberId, circleId, input));
}

export async function updateResourceAction(id: string, input: ResourceInput) {
  return asMember((memberId) => resources.updateResource(memberId, id, input));
}

export async function deleteResourceAction(id: string) {
  return asMember((memberId) => resources.deleteResource(memberId, id));
}

export async function createEventAction(draft: EventDraft) {
  const result = await asMember((memberId) => events.createEvent(memberId, draft));
  // createEvent has already queued the emails (if this event earns any);
  // sending them after the response keeps the form from waiting on SMTP
  if (result.ok) after(() => deliverEventNotifications());
  return result;
}

// `scope` is for a date of a repeating event: that date alone, or it and every
// later one (see lib/db/events.ts)
export async function updateEventDetailsAction(id: string, details: EventDetails, scope: SeriesScope = "one") {
  return asMember((memberId) => events.updateEventDetails(memberId, id, details, scope));
}

// cancelling may have queued emails to the people who were going, which go
// out once the response is sent, as a new event's do
export async function cancelEventAction(id: string, scope: SeriesScope = "one") {
  const result = await asMember((memberId) => events.cancelEvent(memberId, id, scope));
  if (result.ok && result.value.events.some((e) => e.cancelled)) after(() => deliverEventNotifications());
  return result;
}

export async function setRsvpAction(id: string, going: boolean) {
  return asMember((memberId) => events.setRsvp(memberId, id, going));
}

export async function setVoteAction(id: string, voting: boolean) {
  const result = await asMember((memberId) => events.setVote(memberId, id, voting));
  // this vote may have queued emails: it approved a circle-hosted event (which
  // is no longer a proposal — further votes are refused), or it may have
  // approved a meeting
  if (result.ok && (result.value.kind === "meeting" || (result.value.hostCircleId && !result.value.proposed))) {
    after(() => deliverEventNotifications());
  }
  return result;
}

export async function toggleRoleSlotAction(id: string, roleKey: string) {
  return asMember((memberId) => events.toggleRoleSlot(memberId, id, roleKey));
}

/* A system admin's decision on an application (lib/db/applications.ts checks
   they are one). The decision stands whether or not its email goes out, so a
   failed send comes back as `emailed: false` for the admin to follow up on,
   rather than as a refusal. */
async function tellApplicant(decision: applications.Decision, approved: boolean): Promise<{ emailed: boolean }> {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  try {
    await sendEmail({
      to: decision.email,
      ...(approved ? applicationApprovedEmail({ ...decision, url: base }) : applicationDeclinedEmail(decision)),
    });
    return { emailed: true };
  } catch (err) {
    console.error("Couldn't email an applicant:", err);
    return { emailed: false };
  }
}

export async function approveApplicationAction(id: string) {
  return asMember(async (memberId) => tellApplicant(await applications.approveApplication(memberId, id), true));
}

export async function declineApplicationAction(id: string, note: string) {
  return asMember(async (memberId) => tellApplicant(await applications.declineApplication(memberId, id, note), false));
}
