"use client";

import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/shared";
import { isOutdatedVersion } from "@/lib/app-version";
import {
  cancelEventAction as dbCancelEvent,
  createEventAction as dbCreateEvent,
  createResourceAction as dbCreateResource,
  deleteResourceAction as dbDeleteResource,
  loadAppStateAction as dbLoadAppState,
  setRsvpAction as dbSetRsvp,
  toggleRoleSlotAction as dbToggleRoleSlot,
  createProposalAction as dbCreateProposal,
  respondToProposalAction as dbRespondToProposal,
  updateCircleAction as dbUpdateCircle,
  updateEventDetailsAction as dbUpdateEventDetails,
  updateMemberAction as dbUpdateMember,
  updateMemberPhotoAction as dbUpdateMemberPhoto,
  updateResourceAction as dbUpdateResource,
  createInvitationAction as dbCreateInvitation,
  acceptInvitationAction as dbAcceptInvitation,
  leaveCircleAction as dbLeaveCircle,
  deleteInvitationAction as dbDeleteInvitation,
  saveNotificationSettingsAction as dbSaveNotificationSettings,
  saveAvailabilityAction as dbSaveAvailability,
  createCircleAction as dbCreateCircle,
  proposeNeighborhoodPostAction as dbProposeNeighborhoodPost,
  removeNeighborhoodPostAction as dbRemoveNeighborhoodPost,
} from "@/lib/db/actions";
import type { AppStateData } from "@/lib/db/app-state";
import { audienceLabel, indexCircles } from "@/lib/circles.util";
import type { CircleRoleDraft } from "@/lib/circle-roles.util";
import type { NewCircleInput } from "@/lib/circles.util";
import type { EventDetails, EventDraft, SeriesScope } from "@/lib/events.util";
import { repeatSummary } from "@/lib/recurrence.util";
import type { ResourceInput } from "@/lib/resources.util";
import type { AvailabilityWindow, Circle, CircleInvitation, CircleProposal, CircleResource, ConsentResponse, Event, Member, NeighborhoodPost, NotificationSettings, Profile, ProposalChanges } from "@/lib/types";

// what an awaited mutator hands back: the form stays open and shows `error`
// when the server refused it
export type MutationResult = { ok: true } | { ok: false; error: string };

export interface AppStateValue {
  events: Event[];
  circles: Circle[];
  members: Member[];
  // members-only: only the viewer's own circles' resources are ever loaded
  resources: CircleResource[];
  // their neighborhood's bulletin, and what their own circles have posted
  // (only residents, and the posting circle's members, are ever sent a post)
  neighborhoodPosts: NeighborhoodPost[];
  // their own invitations to circles, and those to the circles they're in
  invitations: CircleInvitation[];
  // the proposals of their circles: open ones, and those decided lately
  proposals: CircleProposal[];
  // applications waiting for review: a number for a system admin, else null
  pendingReviews: number | null;
  rsvpState: Record<string, boolean>;
  profile: Profile;
  toggleRsvp(eventId: string): void;
  toggleRoleSlot(eventId: string, roleKey: string): void;
  // proposalId: a group's event, proposed to it rather than created outright
  createEvent(draft: EventDraft): Promise<{ ok: true; event: Event; proposalId?: string } | { ok: false; error: string }>;
  updateEventDetails(id: string, details: EventDetails, scope?: SeriesScope): Promise<MutationResult>;
  cancelEvent(id: string, scope?: SeriesScope): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }>;
  // resolves to the new circle, for the caller to go to, or for a Circle in a
  // neighborhood, the proposal asking the neighborhood (and the circle, if
  // a neighborhood of one made it at once)
  createCircle(input: NewCircleInput): Promise<{ ok: true; circle: Circle } | { ok: true; proposal: CircleProposal; circleId: string | null } | { ok: false; error: string }>;
  saveCircle(id: string, patch: Partial<Circle>): void;
  // propose changes to a circle, for its members' consent; `passed` when it
  // was decided at once (a circle of one)
  proposeCircleChanges(circleId: string, changes: ProposalChanges): Promise<{ ok: true; proposal: CircleProposal; passed: boolean } | { ok: false; error: string }>;
  respondToProposal(id: string, response: ConsentResponse, reason?: string): Promise<MutationResult>;
  // photoPending: a new photo saved with it is waiting for review, which the toast says
  saveProfile(next: Profile, options?: { photoPending?: boolean }): void;
  // pending: it waits for a system admin's review, so only they see it yet
  savePhoto(photo: Blob): Promise<{ ok: true; pending: boolean } | { ok: false; error: string }>;
  saveNotificationSettings(settings: NotificationSettings): Promise<MutationResult>;
  saveAvailability(windows: AvailabilityWindow[]): Promise<MutationResult>;
  addResource(circleId: string, input: ResourceInput): Promise<MutationResult>;
  updateResource(id: string, input: ResourceInput): Promise<MutationResult>;
  removeResource(id: string): Promise<MutationResult>;
  // propose a post to the neighborhood's bulletin for `circleId`'s consent;
  // `published` when a circle of one posted it at once
  proposeNeighborhoodPost(circleId: string, input: ResourceInput): Promise<{ ok: true; proposalId: string; published: boolean } | { ok: false; error: string }>;
  removeNeighborhoodPost(id: string): Promise<MutationResult>;
  // an admin decided one, so there's one fewer waiting (until the next refresh)
  reviewDecided(): void;
  inviteToCircle(circleId: string, memberId: number): Promise<MutationResult>;
  // resolves to the circle joined, for the caller to go to
  acceptInvitation(id: string): Promise<{ ok: true; circleId: string } | { ok: false; error: string }>;
  // `archived` when they were its last member (see leaveCircle)
  leaveCircle(circleId: string): Promise<{ ok: true; archived: boolean } | { ok: false; error: string }>;
  // `declining`: the invitee turning it down, rather than a member deleting it
  deleteInvitation(id: string, declining: boolean): Promise<MutationResult>;
}

/* Holds the app's runtime state — events, circles, members, the current
   user's RSVPs and profile — plus the mutations on it. This is the single
   source of truth every route reads from instead of a fetch. Mounted once in
   the (app) layout, seeded from data the DAL (lib/db/) fetched server-side —
   see that layout for the fetch.

   Mutators here are pure state + toast — they never navigate. Where the
   original single-view app followed a mutation with a view change, that's now
   the calling route's job (it has the router; this provider shouldn't).
   Each mutator also calls the matching lib/db/ write (through
   lib/db/actions.ts's Server Actions), fire-and-forget — no rollback yet,
   only a console.error on a rejected write. The event RSVP/slot
   toggles are optimistic too, but the server can refuse them (an event's
   circle decides who may act on it), so they adopt the server's version of
   the event on success and roll the change back with an error toast on
   refusal. Creating/editing an event and the resource mutators await the
   server and update state only once it accepts, because it generates ids and
   validates. */
const AppStateContext = createContext<AppStateValue | null>(null);

// how often the data is refreshed while the app is on screen
const REFRESH_EVERY_MS = 60_000;
// refreshes closer together than this are skipped, however they're prompted
const MIN_REFRESH_GAP_MS = 15_000;
// how long the app has to have been away before coming back to it also
// checks it's still the version the server is running (see refresh)
const AWAY_LONG_MS = 60_000;
// a refresh started this soon after a change is dropped, in case it read the
// database before that change landed
const RECENT_WRITE_MS = 10_000;

// replace each of `changed` in `prev` by id, adding any that are new — for an
// action that answers with several events (the dates of a repeating one)
function mergeEvents(prev: Event[], changed: Event[]): Event[] {
  const byId = new Map(changed.map((e) => [e.id, e]));
  return [...prev.map((e) => byId.get(e.id) ?? e), ...changed.filter((e) => !prev.some((p) => p.id === e.id))];
}

// { [eventId]: true } for the events the current user has RSVPed to, ...
function ownFlags(events: Event[], has: (e: Event) => boolean): Record<string, boolean> {
  return Object.fromEntries(events.filter(has).map((e) => [e.id, true]));
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

interface AppStateProviderProps {
  children: ReactNode;
  currentUserId: number;
  initialEvents: Event[];
  initialCircles: Circle[];
  initialMembers: Member[];
  initialResources: CircleResource[];
  initialNeighborhoodPosts: NeighborhoodPost[];
  initialPendingReviews: number | null;
  initialInvitations: CircleInvitation[];
  initialProposals: CircleProposal[];
  initialProfile: Profile;
}

export function AppStateProvider({ children, currentUserId, initialEvents, initialCircles, initialMembers, initialResources, initialNeighborhoodPosts, initialProfile, initialPendingReviews, initialInvitations, initialProposals }: AppStateProviderProps) {
  const { showToast } = useToast();
  // events live in state so newly created ones appear instantly
  const [events, setEvents] = useState<Event[]>(() => initialEvents.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) })));
  // circles live in state so member edits (bio, offers, needs) persist; seeded from the DAL fetch
  const [circles, setCircles] = useState<Circle[]>(() => initialCircles.map((c) => ({ ...c, offers: [...c.offers], needs: [...c.needs], members: [...c.members] })));
  // the roster, so names/avatars/home circles resolve from live data rather
  // than a static seed array; the signed-in member's own edits are mirrored in
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [resources, setResources] = useState<CircleResource[]>(initialResources);
  const [neighborhoodPosts, setNeighborhoodPosts] = useState<NeighborhoodPost[]>(initialNeighborhoodPosts);
  const [pendingReviews, setPendingReviews] = useState(initialPendingReviews);
  const [invitations, setInvitations] = useState<CircleInvitation[]>(initialInvitations);
  const [proposals, setProposals] = useState<CircleProposal[]>(initialProposals);
  // rsvpState: { [eventId]: true } — the current user's own RSVPs, persisted across routes
  const [rsvpState, setRsvpState] = useState<Record<string, boolean>>(() => ownFlags(initialEvents, (e) => e.rsvps.includes(currentUserId)));
  // the current user's own editable profile (seeded from their member record)
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initialProfile,
    skills: [...initialProfile.skills],
    interests: [...initialProfile.interests],
  }));

  // when this session last changed anything, so a refresh that might predate
  // the change doesn't overwrite it (see refresh)
  const lastWrite = useRef(0);
  const tracked = <A extends unknown[], R>(mutate: (...args: A) => R) => (...args: A) => {
    lastWrite.current = Date.now();
    return mutate(...args);
  };

  // when the data was last loaded (by the (app) layout, at first), and
  // whether a refresh is on its way now
  const lastRefresh = useRef(0);
  const refreshing = useRef(false);

  /* Everything here is loaded once, when the (app) layout renders, and pages
     render from it without fetching, so it's reloaded as a whole: on every
     return to the app, every REFRESH_EVERY_MS while it's on screen, and when
     the connection comes back — so what someone else did shows up within
     about a minute, and at once on coming back.

     After a deploy, this copy of the app is out of date: its Server Actions
     no longer exist on the server, so saves fail (and so does this refresh,
     quietly). Reloading the page fixes that, but could throw away a form
     someone is partway through, so it's only checked for (checkVersion) on
     coming back after a while away; otherwise the next navigation does it,
     since Next's router reloads the page itself on meeting a newer build. */
  // take in the whole of what the server says the app holds: a refresh, or an
  // accepted invitation (which opens up the new circle's events and bulletin)
  function adopt(fresh: AppStateData) {
    setEvents(fresh.events);
    setCircles(fresh.circles);
    setMembers(fresh.members);
    setResources(fresh.resources);
    setNeighborhoodPosts(fresh.neighborhoodPosts);
    setInvitations(fresh.invitations);
    setProposals(fresh.proposals);
    setPendingReviews(fresh.pendingReviews);
    setRsvpState(ownFlags(fresh.events, (e) => e.rsvps.includes(currentUserId)));
    setProfile(fresh.profile);
  }

  const refresh = useEffectEvent(async (checkVersion: boolean) => {
    if (refreshing.current || !navigator.onLine || Date.now() - lastRefresh.current < MIN_REFRESH_GAP_MS) return;
    refreshing.current = true;
    lastRefresh.current = Date.now();
    try {
      if (checkVersion && (await isOutdatedVersion())) {
        window.location.reload();
        return;
      }
      const startedAt = Date.now();
      // unreachable (offline, say), or out of date: keep showing what we have
      const result = await dbLoadAppState().catch(() => null);
      if (!result) return;
      if (!result.ok) {
        // signed out: a full load, not router.push, so none of what they'd
        // loaded stays in memory behind the welcome page
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
        return;
      }
      // a change made just before or while this ran may be missing from what came back
      if (lastWrite.current >= startedAt - RECENT_WRITE_MS) return;
      adopt(result.value);
    } finally {
      refreshing.current = false;
    }
  });

  useEffect(() => {
    lastRefresh.current = Date.now();
    let hiddenAt: number | null = null;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      refresh(hiddenAt !== null && Date.now() - hiddenAt >= AWAY_LONG_MS);
      hiddenAt = null;
    }
    function onOnline() {
      refresh(false);
    }
    // an interval rather than a timeout chain: a refresh skipped for being too
    // soon after another just waits for the next tick
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh(false);
    }, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // runs a server event action: on success adopts the server's version of the
  // event (so state can't drift from what was actually saved); if the server
  // refuses, undoes the optimistic change and says why
  async function syncEvent(eventId: string, run: () => Promise<{ ok: true; value: Event } | { ok: false; error: string }>, undo: () => void) {
    const result = await run().catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (result.ok) {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? result.value : e)));
      return;
    }
    undo();
    showToast({ tone: "error", title: "Couldn't save that", message: result.error });
  }

  function toggleRsvp(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const wasGoing = !!rsvpState[eventId];
    const willGo = !wasGoing;
    setRsvpState((prev) => {
      const next = { ...prev, [eventId]: willGo };
      if (!willGo) delete next[eventId];
      return next;
    });
    // keep the event's rsvp list in sync immutably so counts & rosters agree
    // across views. Computed from `events` (already in scope) rather than
    // inside a setEvents updater — a value a functional updater assigns isn't
    // available synchronously afterward (React doesn't run it inline).
    const has = event.rsvps.includes(currentUserId);
    const nextRsvps =
      willGo && !has ? [...event.rsvps, currentUserId] : !willGo && has ? event.rsvps.filter((id) => id !== currentUserId) : event.rsvps;
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, rsvps: nextRsvps } : e)));
    void syncEvent(eventId, () => dbSetRsvp(eventId, willGo), () => {
      setRsvpState((prev) => {
        const next = { ...prev, [eventId]: wasGoing };
        if (!wasGoing) delete next[eventId];
        return next;
      });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? event : e)));
    });
  }

  // join or leave a specific role slot on a slotted event (e.g. shift lead).
  // the current user may hold at most one role per event.
  function toggleRoleSlot(eventId: string, roleKey: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event || !Array.isArray(event.roles)) return;
    const nextRoles = event.roles.map((r) => {
      if (r.key === roleKey) {
        const has = r.members.includes(currentUserId);
        if (!has && r.max != null && r.members.length >= r.max) return r; // slot full — can't join
        return { ...r, members: has ? r.members.filter((id) => id !== currentUserId) : [...r.members, currentUserId] };
      }
      // leaving any other role the user might hold, so they hold one slot at a time
      return { ...r, members: r.members.filter((id) => id !== currentUserId) };
    });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, roles: nextRoles } : e)));
    void syncEvent(eventId, () => dbToggleRoleSlot(eventId, roleKey), () => setEvents((prev) => prev.map((e) => (e.id === eventId ? event : e))));
  }

  // the server generates the id and decides the organizer (always the caller)
  // and who starts out attending, so this waits for it and returns the
  // created event for the caller to navigate to
  async function createEvent(draft: EventDraft): Promise<{ ok: true; event: Event; proposalId?: string } | { ok: false; error: string }> {
    const result = await dbCreateEvent(draft);
    if (!result.ok) return result;
    // the event, and for a repeating one its next few dates
    const created = result.value.events;
    const ev = created[0];
    if (!ev) return { ok: false, error: "Something went wrong — try again." };
    // a meeting or circle-hosted event is proposed to its circle; it's in no
    // list until its members consent, so the caller goes to its proposal
    if ("state" in result.value && result.value.proposalId) {
      adopt(result.value.state);
      const decider = circles.find((c) => c.id === (ev.hostCircleId ?? ev.circleId));
      const noun = ev.kind === "meeting" ? "Meeting" : "Event";
      showToast(!ev.proposed
        ? { tone: "success", title: `${noun} scheduled`, message: `${ev.title} is on ${decider?.name ?? "the circle"}'s calendar.` }
        : { tone: "success", title: `${noun} proposed`, message: `It's scheduled once ${decider?.name ?? "the circle"}'s members consent, or in 3 days if no one objects.` });
      return { ok: true, event: ev, proposalId: result.value.proposalId };
    }
    setEvents((prev) => [...prev, ...created]);
    // the creator is attending
    setRsvpState((prev) => ({ ...prev, ...ownFlags(created, (e) => e.rsvps.includes(currentUserId)) }));
    const repeats = ev.repeat ? ` It repeats ${repeatSummary(ev.repeat).replace(/^./, (c) => c.toLowerCase())}.` : "";
    const circle = circles.find((c) => c.id === ev.circleId);
    const hostCircle = ev.hostCircleId ? circles.find((c) => c.id === ev.hostCircleId) : undefined;
    if (ev.approvedByRole) {
      showToast({
        tone: "success",
        title: "Meeting scheduled",
        message: `As ${circle?.name ?? "the circle"}'s ${ev.approvedByRole}, you've put it on the calendar without asking for consent. Its ${circle?.type === "neighborhood" ? "residents" : "members"} will be notified and can RSVP.`,
      });
    } else {
      // the circle is the audience: only its members (everyone, for the city)
      // can see the event. "RSVPs are open" would be wrong for a role-slotted
      // event (see lib/roles.util.ts), so the message stays agnostic to which
      // one this event actually uses.
      showToast({
        tone: "success",
        title: "Event created",
        message: `${ev.title} is on the calendar for ${circle && circle.parentId !== null ? `members of ${circle.name}` : "everyone"}.${repeats}`,
      });
    }
    return { ok: true, event: ev };
  }

  // save edits to an event's own details (title/date/location/slots/etc.) from
  // the edit-event form — organizer only, enforced by the server; the circle,
  // kind and rsvps aren't editable here (toggleRsvp owns those)
  // `scope` is for a date of a repeating event: that one, or every date from it on
  async function updateEventDetails(id: string, details: EventDetails, scope: SeriesScope = "one"): Promise<MutationResult> {
    const result = await dbUpdateEventDetails(id, details, scope);
    if (!result.ok) return result;
    setEvents((prev) => mergeEvents(prev, result.value));
    showToast({
      tone: "success",
      title: "Changes saved",
      message: result.value.length > 1
        ? `Your edits are now live on this date and the ${result.value.length - 1} after it, and on every date still to come.`
        : "Your edits are now live for everyone who can see this event.",
    });
    return { ok: true };
  }

  // await-then-update: the server decides between keeping it, cancelled, for the
  // people who were going, and deleting it outright when no one else was
  // `scope: "upcoming"` on a date of a repeating event cancels it and every
  // later date, and ends the series — the answer is every date deleted, and
  // every one left as it now stands
  async function cancelEvent(id: string, scope: SeriesScope = "one"): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
    const result = await dbCancelEvent(id, scope).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    // a group's proposed event: withdrawn, with its proposal
    if ("state" in result.value) {
      adopt(result.value.state);
      showToast({ tone: "success", title: "Proposal withdrawn", message: "The event won't be held, and its proposal is closed." });
      return { ok: true, deleted: true };
    }
    const { deletedIds, events: changed } = result.value;
    const gone = new Set(deletedIds);
    setEvents((prev) => mergeEvents(prev.filter((e) => !gone.has(e.id)), changed));
    const drop = (prev: Record<string, boolean>) => Object.fromEntries(Object.entries(prev).filter(([key]) => !gone.has(key)));
    setRsvpState(drop);
    const deleted = gone.has(id);
    const emailed = changed.some((e) => e.cancelled && !events.find((p) => p.id === e.id)?.cancelled);
    if (scope === "upcoming") {
      showToast({
        tone: "success",
        title: "Dates cancelled",
        message: `This date and every later one are off, and no more will be added.${emailed ? " Everyone who was going is being emailed." : ""}`,
      });
    } else if (deleted) {
      showToast({ tone: "success", title: "Event deleted", message: "No one else was going, so it's been removed." });
    } else {
      showToast({ tone: "success", title: "Event cancelled", message: "Everyone who was going is being emailed." });
    }
    return { ok: true, deleted };
  }

  // a proposal's latest, and the circle as it now is if it just passed
  function takeProposal(proposal: CircleProposal, circle: Circle | null) {
    setProposals((prev) => [proposal, ...prev.filter((p) => p.id !== proposal.id)]);
    if (circle) setCircles((prev) => prev.map((c) => (c.id === circle.id ? circle : c)));
  }

  // await-then-update: the server checks the change and can refuse (one's
  // already open, say), and may decide it at once for a circle of one
  async function proposeCircleChanges(circleId: string, changes: ProposalChanges): Promise<{ ok: true; proposal: CircleProposal; passed: boolean } | { ok: false; error: string }> {
    const result = await dbCreateProposal(circleId, changes).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    takeProposal(result.value.proposal, result.value.circle);
    return { ok: true, proposal: result.value.proposal, passed: result.value.proposal.status === "passed" };
  }

  async function respondToProposal(id: string, response: ConsentResponse, reason?: string): Promise<MutationResult> {
    const result = await dbRespondToProposal(id, response, reason).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    // a group's event proposal may have approved or discarded its event: take it all
    if ("state" in result.value) adopt(result.value.state);
    else takeProposal(result.value.proposal, result.value.circle);
    return { ok: true };
  }

  // await-then-update, like resources: the server can refuse, and it chooses
  // the id the new circle's page is reached by
  async function createCircle(input: NewCircleInput): Promise<{ ok: true; circle: Circle } | { ok: true; proposal: CircleProposal; circleId: string | null } | { ok: false; error: string }> {
    const result = await dbCreateCircle(input).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    const made = result.value;
    if (made.state) {
      adopt(made.state);
      return { ok: true, proposal: made.proposal, circleId: made.circleId };
    }
    const circle = made.circle;
    setCircles((prev) => [...prev, circle]);
    return { ok: true, circle };
  }

  // await-then-update: the server checks it's a Circle in a neighborhood, and
  // a circle of one posts it at once; either way the whole state comes back
  async function proposeNeighborhoodPost(circleId: string, input: ResourceInput): Promise<{ ok: true; proposalId: string; published: boolean } | { ok: false; error: string }> {
    const result = await dbProposeNeighborhoodPost(circleId, input).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    adopt(result.value.state);
    return { ok: true, proposalId: result.value.proposalId, published: result.value.published };
  }

  async function removeNeighborhoodPost(id: string): Promise<MutationResult> {
    const result = await dbRemoveNeighborhoodPost(id).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't take it down", message: result.error });
      return result;
    }
    adopt(result.value);
    showToast({ tone: "success", message: "Taken down from the bulletin." });
    return { ok: true };
  }

  // save edits to a circle and record who edited it and when
  function saveCircle(id: string, patch: Partial<Circle>) {
    const fullPatch: Partial<Circle> = { ...patch, lastEditedBy: currentUserId, lastEditedAt: new Date().toISOString() };
    setCircles((prev) => prev.map((c) => (c.id === id ? { ...c, ...fullPatch } : c)));
    // asMember (lib/db/actions.ts) never rejects — a refusal (not a member,
    // signed out) comes back as { ok: false }, not a throw — so this checks
    // the result rather than relying on .catch(), which would otherwise never
    // fire and let a refusal disappear silently
    dbUpdateCircle(id, fullPatch).then((result) => {
      if (!result.ok) console.error(result.error);
    });
    const circle = circles.find((c) => c.id === id);
    showToast({
      tone: "success",
      title: "Changes saved",
      message: `Your edits to ${circle ? circle.name : "the circle"} are now live for everyone to see.`,
    });
  }

  // save edits from the Edit Myself page back to the profile
  function saveProfile(next: Profile, { photoPending = false }: { photoPending?: boolean } = {}) {
    // the photo isn't part of this save (see savePhoto), and may have just
    // changed since the form's draft was copied
    setProfile((p) => {
      const { pendingPhotoVersion: _stale, ...rest } = next;
      return { ...rest, photoVersion: p.photoVersion, ...(p.pendingPhotoVersion !== undefined ? { pendingPhotoVersion: p.pendingPhotoVersion } : {}) };
    });
    setMembers((prev) =>
      prev.map((m) =>
        m.id === next.id
          ? { ...m, name: next.name, lastName: next.lastName, pronouns: next.pronouns, role: next.role, skills: next.skills, interests: next.interests, bio: next.bio, email: next.email, birthDecade: next.birthDecade, languages: next.languages }
          : m
      )
    );
    // see saveCircle above — asMember never rejects, so the result is what
    // tells us whether it actually saved
    // null, not undefined, clears the decade: an undefined field is dropped on its way to the server
    dbUpdateMember({ ...next, birthDecade: next.birthDecade ?? null }).then((result) => {
      if (!result.ok) console.error(result.error);
    });
    showToast({
      tone: "success",
      title: "Changes saved",
      message: photoPending ? "Your new photo will show once a Circles admin has approved it." : "Your details have been updated.",
    });
  }

  // await-then-update, like the resources below: the server can refuse the
  // file, and the new photo's URL depends on the version it assigns. No toast
  // of its own — the Edit Myself page follows it with saveProfile's. Most
  // members' new photo waits for review, so it's only their own Profile that
  // learns of it; an admin's goes live, as before.
  async function savePhoto(photo: Blob): Promise<{ ok: true; pending: boolean } | { ok: false; error: string }> {
    const form = new FormData();
    form.set("photo", photo);
    const result = await dbUpdateMemberPhoto(form).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    const saved = result.value;
    if ("pending" in saved) {
      setProfile((p) => ({ ...p, pendingPhotoVersion: saved.pending }));
      return { ok: true, pending: true };
    }
    const photoVersion = saved.live;
    setProfile(({ pendingPhotoVersion: _replaced, ...p }) => ({ ...p, photoVersion }));
    setMembers((prev) => prev.map((m) => (m.id === profile.id ? { ...m, photoVersion } : m)));
    return { ok: true, pending: false };
  }

  // await-then-update: Settings → Notifications stays open to say why if the
  // server refuses, and its own page shows the toast once it's done
  async function saveNotificationSettings(settings: NotificationSettings): Promise<MutationResult> {
    const result = await dbSaveNotificationSettings(settings).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    const notifications = result.value;
    setProfile((p) => ({ ...p, notifications }));
    return { ok: true };
  }

  // await-then-update, like the notification settings: the server may refuse
  // the schedule, and it hands back the normalized one to show
  async function saveAvailability(windows: AvailabilityWindow[]): Promise<MutationResult> {
    const result = await dbSaveAvailability(windows).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    const availability = result.value;
    setProfile((p) => ({ ...p, availability }));
    return { ok: true };
  }

  async function addResource(circleId: string, input: ResourceInput): Promise<MutationResult> {
    const result = await dbCreateResource(circleId, input);
    if (!result.ok) return result;
    setResources((prev) => [result.value, ...prev]);
    showToast({ tone: "success", title: "Item added", message: `${result.value.title} is now on the bulletin.` });
    return { ok: true };
  }

  async function updateResource(id: string, input: ResourceInput): Promise<MutationResult> {
    const result = await dbUpdateResource(id, input);
    if (!result.ok) return result;
    setResources((prev) => prev.map((r) => (r.id === id ? result.value : r)));
    showToast({ tone: "success", title: "Item updated", message: "Your changes are saved." });
    return { ok: true };
  }

  async function removeResource(id: string): Promise<MutationResult> {
    const result = await dbDeleteResource(id);
    if (!result.ok) return result;
    setResources((prev) => prev.filter((r) => r.id !== id));
    showToast({ tone: "success", title: "Item removed", message: "It's no longer on the bulletin." });
    return { ok: true };
  }

  // invitations are await-then-update, like resources: the server decides who
  // may, and generates the id
  async function inviteToCircle(circleId: string, memberId: number): Promise<MutationResult> {
    const result = await dbCreateInvitation(circleId, memberId);
    if (!result.ok) return result;
    setInvitations((prev) => [result.value, ...prev]);
    const invitee = members.find((m) => m.id === memberId);
    const circle = circles.find((c) => c.id === circleId);
    showToast({ tone: "success", title: "Invitation sent", message: `${invitee?.name ?? "They"} will see it on their Home page, and can join ${circle?.name ?? "the circle"} from there.` });
    return { ok: true };
  }

  // await-then-update, adopting the whole app state the server hands back,
  // as accepting an invitation does: leaving closes off the circle's
  // bulletin and the events shown only to it
  async function leaveCircle(circleId: string): Promise<{ ok: true; archived: boolean } | { ok: false; error: string }> {
    const name = circles.find((c) => c.id === circleId)?.name ?? "the circle";
    const result = await dbLeaveCircle(circleId).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    adopt(result.value.state);
    showToast(
      result.value.archived
        ? { tone: "success", title: `You've left ${name}`, message: "You were its last member, so it's been archived." }
        : { tone: "success", title: `You've left ${name}` }
    );
    return { ok: true, archived: result.value.archived };
  }

  async function acceptInvitation(id: string): Promise<{ ok: true; circleId: string } | { ok: false; error: string }> {
    const result = await dbAcceptInvitation(id);
    if (!result.ok) return result;
    adopt(result.value.state);
    const circle = result.value.state.circles.find((c) => c.id === result.value.circleId);
    showToast({ tone: "success", title: `You've joined ${circle?.name ?? "the circle"}`, message: "Its bulletin and events are open to you now." });
    return { ok: true, circleId: result.value.circleId };
  }

  async function deleteInvitation(id: string, declining: boolean): Promise<MutationResult> {
    const result = await dbDeleteInvitation(id);
    if (!result.ok) return result;
    setInvitations((prev) => prev.filter((i) => i.id !== id));
    showToast(declining
      ? { tone: "success", title: "Invitation declined", message: "It's been removed." }
      : { tone: "success", title: "Invitation deleted", message: "It's been withdrawn." });
    return { ok: true };
  }

  // circles aren't filtered by the viewer's own neighborhood — the Circles
  // page nests every neighborhood at the city root specifically so any
  // neighborhood's whole subtree can be browsed into, not just the viewer's
  // home one. Home's own "Local circles"/"My circles" cards narrow to the
  // viewer's neighborhood themselves (see home.page.tsx), independent of this
  // array.

  return (
    <AppStateContext.Provider
      value={{
        events, circles, members, resources, neighborhoodPosts, invitations, proposals, pendingReviews, rsvpState, profile,
        inviteToCircle: tracked(inviteToCircle),
        acceptInvitation: tracked(acceptInvitation),
        leaveCircle: tracked(leaveCircle),
        deleteInvitation: tracked(deleteInvitation),
        reviewDecided: tracked(() => setPendingReviews((n) => (n === null ? n : Math.max(0, n - 1)))),
        toggleRsvp: tracked(toggleRsvp),
        toggleRoleSlot: tracked(toggleRoleSlot),
        createEvent: tracked(createEvent),
        updateEventDetails: tracked(updateEventDetails),
        cancelEvent: tracked(cancelEvent),
        createCircle: tracked(createCircle),
        saveCircle: tracked(saveCircle),
        proposeCircleChanges: tracked(proposeCircleChanges),
        respondToProposal: tracked(respondToProposal),
        saveProfile: tracked(saveProfile),
        savePhoto: tracked(savePhoto),
        saveNotificationSettings: tracked(saveNotificationSettings),
        saveAvailability: tracked(saveAvailability),
        addResource: tracked(addResource),
        updateResource: tracked(updateResource),
        removeResource: tracked(removeResource),
        proposeNeighborhoodPost: tracked(proposeNeighborhoodPost),
        removeNeighborhoodPost: tracked(removeNeighborhoodPost),
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
