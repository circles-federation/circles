"use server";

import { after } from "next/server";
import * as applications from "./applications";
import * as availability from "./availability";
import { getAppStateForMember, type AppStateData } from "./app-state";
import * as circles from "./circles";
import { UserFacingError } from "./errors";
import * as events from "./events";
import * as invitations from "./invitations";
import * as members from "./members";
import * as proposals from "./proposals";
import * as push from "./push";
import * as resources from "./resources";
import { sendEmail } from "@/lib/email";
import { applicationApprovedEmail, applicationDeclinedEmail, invitationEmail } from "@/lib/email/templates.util";
import { deliverAnnouncementNotifications, deliverEventNotifications, deliverProposalNotifications, pushToMember } from "@/lib/notify";
import type { PushSubscriptionKeys } from "@/lib/push";
import { invitationPush } from "@/lib/push/messages.util";
import { getCurrentUserId } from "@/lib/session";
import type { NewCircleInput } from "@/lib/circles.util";
import type { EventDetails, EventDraft, SeriesScope } from "@/lib/events.util";
import { isEventProposal } from "@/lib/proposals.util";
import type { ResourceInput } from "@/lib/resources.util";
import type { AvailabilityWindow, Circle, ConsentResponse, NotificationSettings, ProposalChanges } from "@/lib/types";

/* AppStateProvider is a Client Component and can't hold a real DB
   connection — Drizzle's Postgres driver is Node-only. These thin wrappers
   are the boundary it calls through instead, the same "use server" pattern
   lib/auth.ts already uses. Reads don't need this: app/(app)/layout.tsx is
   already a Server Component and imports lib/db/*.ts directly. */

/* Both authorized against the session like every other write below —
   updateMemberAction never takes an id at all, so there's no id a caller
   could substitute someone else's for; updateCircleAction requires the
   session member to belong to the circle (lib/db/circles.ts). */
export async function updateMemberAction(patch: members.ProfilePatch) {
  return asMember((memberId) => members.updateMember(memberId, patch));
}

// Settings → Notifications: always the session member's own
export async function saveNotificationSettingsAction(settings: NotificationSettings) {
  return asMember((memberId) => members.setNotificationSettings(memberId, settings));
}

// Settings → Meeting availability: always the session member's own
export async function saveAvailabilityAction(windows: AvailabilityWindow[]) {
  return asMember((memberId) => members.setAvailability(memberId, windows));
}

// the meeting form: who in a circle can make this time (members of it only)
export async function meetingAvailabilityAction(circleId: string, date: string, start: string, end: string) {
  return asMember((memberId) => availability.getMeetingAvailability(memberId, circleId, date, start, end));
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

// Create circle: the session member creates it and becomes its first member
export async function createCircleAction(input: NewCircleInput) {
  return asMember((memberId) => circles.createCircle(memberId, input));
}

/* Proposals: changes to a circle its members decide by consent
   (lib/db/proposals.ts checks who may do each). Both may have queued news for
   the circle, sent once the response is out, and both hand back the circle as
   it now is if the proposal passed then and there. */
export async function createProposalAction(circleId: string, changes: ProposalChanges) {
  const result = await asMember((memberId) => proposals.createProposal(memberId, circleId, changes));
  if (result.ok) after(() => deliverProposalNotifications());
  return result;
}

// an answer to a group's event proposal may approve the event or discard it,
// so it hands back the whole app state too, for both to show at once
export async function respondToProposalAction(id: string, response: ConsentResponse, reason?: string) {
  const result = await asMember(async (memberId) => {
    const answered = await proposals.respondToProposal(memberId, id, response, reason);
    return isEventProposal(answered.proposal) ? { ...answered, state: await stateFor(memberId) } : answered;
  });
  if (result.ok) after(() => Promise.all([deliverProposalNotifications(), deliverEventNotifications()]));
  return result;
}

async function stateFor(memberId: number): Promise<AppStateData> {
  const state = await getAppStateForMember(memberId);
  if (!state) throw new UserFacingError("Sign in again to do that.");
  return state;
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


// a new announcement has queued emails to the circle's members, sent once the
// response is out
export async function createResourceAction(circleId: string, input: ResourceInput) {
  const result = await asMember((memberId) => resources.createResource(memberId, circleId, input));
  if (result.ok && result.value.icon === "announcement") after(() => deliverAnnouncementNotifications());
  return result;
}

export async function updateResourceAction(id: string, input: ResourceInput) {
  return asMember((memberId) => resources.updateResource(memberId, id, input));
}

export async function deleteResourceAction(id: string) {
  return asMember((memberId) => resources.deleteResource(memberId, id));
}

export async function createEventAction(draft: EventDraft) {
  // a group's event is proposed to it, so the app state comes back too, with
  // the proposal in it
  const result = await asMember(async (memberId) => {
    const created = await events.createEvent(memberId, draft);
    return created.proposalId ? { ...created, state: await stateFor(memberId) } : created;
  });
  // createEvent has already queued the emails (if this event earns any);
  // sending them after the response keeps the form from waiting on SMTP
  if (result.ok) after(() => Promise.all([deliverEventNotifications(), deliverProposalNotifications()]));
  return result;
}

// `scope` is for a date of a repeating event: that date alone, or it and every
// later one (see lib/db/events.ts). A new date, time or place may have queued
// emails to the people going, sent once the response is out.
export async function updateEventDetailsAction(id: string, details: EventDetails, scope: SeriesScope = "one") {
  const result = await asMember((memberId) => events.updateEventDetails(memberId, id, details, scope));
  if (result.ok) after(() => deliverEventNotifications());
  return result;
}

// cancelling may have queued emails to the people who were going, which go
// out once the response is sent, as a new event's do
export async function cancelEventAction(id: string, scope: SeriesScope = "one") {
  // withdrawing a group's proposed event closes its proposal, so the app state comes back too
  const result = await asMember(async (memberId) => {
    const cancelled = await events.cancelEvent(memberId, id, scope);
    return cancelled.withdrawnProposalId ? { ...cancelled, state: await stateFor(memberId) } : cancelled;
  });
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

/* Invitations to a circle (lib/db/invitations.ts checks who may do each).
   Accepting hands back the whole of the member's app state, since joining a
   circle opens up its events and bulletin to them. */
// the invitee is told once, by email and by push, right after the response is
// sent; a failed send isn't retried — the invitation is on their Home either way
export async function createInvitationAction(circleId: string, memberId: number) {
  const result = await asMember((inviterId) => invitations.createInvitation(inviterId, circleId, memberId));
  if (result.ok) after(() => tellInvitee(result.value.id));
  return result;
}

async function tellInvitee(id: string) {
  const data = await invitations.getInvitationNoticeData(id).catch((err) => {
    console.error("Couldn't read an invitation to send:", err);
    return null;
  });
  if (!data) return;
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const email = data.email;
  await Promise.all([
    email &&
      sendEmail({ to: email, ...invitationEmail({ ...data, url: `${base}/invitations/${id}` }) }).catch((err) => console.error("Couldn't email an invitee:", err)),
    pushToMember(data.memberId, invitationPush({ ...data, invitationId: id })).catch((err) => console.error("Couldn't push to an invitee:", err)),
  ]);
}

/* Leaving a circle (lib/db/circles.ts checks who may): it hands back the
   whole of the member's app state, as accepting an invitation does, since
   leaving closes off the circle's bulletin and the events shown only to it. */
export async function leaveCircleAction(circleId: string) {
  return asMember(async (memberId) => {
    const { archived } = await circles.leaveCircle(memberId, circleId);
    const state = await getAppStateForMember(memberId);
    if (!state) throw new UserFacingError("Sign in again to do that.");
    return { archived, state };
  });
}

export async function acceptInvitationAction(id: string) {
  return asMember(async (memberId) => {
    const { circleId } = await invitations.acceptInvitation(memberId, id);
    const state = await getAppStateForMember(memberId);
    if (!state) throw new UserFacingError("Sign in again to do that.");
    return { circleId, state };
  });
}

export async function deleteInvitationAction(id: string) {
  return asMember((memberId) => invitations.deleteInvitation(memberId, id));
}

/* This device's push subscription (lib/push-client.ts), always as the session
   member: the browser hands over the subscription, never a member id. */
export async function savePushSubscriptionAction(sub: PushSubscriptionKeys) {
  return asMember((memberId) => push.saveSubscription(memberId, sub));
}

export async function deletePushSubscriptionAction(endpoint: string) {
  return asMember((memberId) => push.deleteSubscription(memberId, endpoint));
}

// development only: a notification to every device the session member has
// turned push on for, to check the whole path end to end
export async function sendTestPushAction() {
  if (process.env.NODE_ENV === "production") return { ok: false as const, error: "Not available." };
  return asMember(async (memberId) => {
    const devices = await pushToMember(memberId, {
      title: "Circles test notification",
      body: "Push notifications are working on this device.",
      url: "/home",
      tag: "test",
    });
    if (devices === 0) throw new UserFacingError("No device has notifications turned on.");
    return devices;
  });
}
