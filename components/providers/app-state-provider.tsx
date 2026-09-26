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
  setVoteAction as dbSetVote,
  toggleRoleSlotAction as dbToggleRoleSlot,
  saveCircleRolesAction as dbSaveCircleRoles,
  updateCircleAction as dbUpdateCircle,
  updateEventDetailsAction as dbUpdateEventDetails,
  updateMemberAction as dbUpdateMember,
  updateMemberPhotoAction as dbUpdateMemberPhoto,
  updateResourceAction as dbUpdateResource,
} from "@/lib/db/actions";
import { audienceLabel, indexCircles } from "@/lib/circles.util";
import type { CircleRoleDraft } from "@/lib/circle-roles.util";
import type { EventDetails, EventDraft } from "@/lib/events.util";
import { isProposal, voteThreshold } from "@/lib/governance.util";
import type { ResourceInput } from "@/lib/resources.util";
import type { Circle, CircleResource, Event, Member, Profile } from "@/lib/types";

// what an awaited mutator hands back: the form stays open and shows `error`
// when the server refused it
export type MutationResult = { ok: true } | { ok: false; error: string };

export interface AppStateValue {
  events: Event[];
  circles: Circle[];
  members: Member[];
  // members-only: only the viewer's own circles' resources are ever loaded
  resources: CircleResource[];
  rsvpState: Record<string, boolean>;
  voteState: Record<string, boolean>;
  profile: Profile;
  toggleRsvp(eventId: string): void;
  toggleRoleSlot(eventId: string, roleKey: string): void;
  createEvent(draft: EventDraft): Promise<{ ok: true; event: Event } | { ok: false; error: string }>;
  updateEventDetails(id: string, details: EventDetails): Promise<MutationResult>;
  cancelEvent(id: string): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }>;
  toggleVote(eventId: string): void;
  saveCircle(id: string, patch: Partial<Circle>): void;
  saveCircleRoles(circleId: string, roles: CircleRoleDraft[]): Promise<MutationResult>;
  saveProfile(next: Profile): void;
  savePhoto(photo: Blob): Promise<MutationResult>;
  addResource(circleId: string, input: ResourceInput): Promise<MutationResult>;
  updateResource(id: string, input: ResourceInput): Promise<MutationResult>;
  removeResource(id: string): Promise<MutationResult>;
}

/* Holds the app's runtime state — events, circles, members, the current
   user's RSVPs/votes/profile — plus the mutations on it. This is the single
   source of truth every route reads from instead of a fetch. Mounted once in
   the (app) layout, seeded from data the DAL (lib/db/) fetched server-side —
   see that layout for the fetch.

   Mutators here are pure state + toast — they never navigate. Where the
   original single-view app followed a mutation with a view change, that's now
   the calling route's job (it has the router; this provider shouldn't).
   Each mutator also calls the matching lib/db/ write (through
   lib/db/actions.ts's Server Actions), fire-and-forget — no rollback yet,
   only a console.error on a rejected write. The event RSVP/vote/slot
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

// { [eventId]: true } for the events the current user has RSVPed to, voted on, ...
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
  initialProfile: Member;
}

export function AppStateProvider({ children, currentUserId, initialEvents, initialCircles, initialMembers, initialResources, initialProfile }: AppStateProviderProps) {
  const { showToast } = useToast();
  // events live in state so newly created ones appear instantly
  const [events, setEvents] = useState<Event[]>(() => initialEvents.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) })));
  // circles live in state so member edits (bio, offers) persist; seeded from the DAL fetch
  const [circles, setCircles] = useState<Circle[]>(() => initialCircles.map((c) => ({ ...c, offers: [...c.offers], members: [...c.members] })));
  // the roster, so names/avatars/home circles resolve from live data rather
  // than a static seed array; the signed-in member's own edits are mirrored in
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [resources, setResources] = useState<CircleResource[]>(initialResources);
  // rsvpState: { [eventId]: true } — the current user's own RSVPs, persisted across routes
  const [rsvpState, setRsvpState] = useState<Record<string, boolean>>(() => ownFlags(initialEvents, (e) => e.rsvps.includes(currentUserId)));
  // voteState: { [eventId]: true } — the current user's votes on meetings
  const [voteState, setVoteState] = useState<Record<string, boolean>>(() => ownFlags(initialEvents, (e) => !!e.votes?.includes(currentUserId)));
  // the current user's own editable profile (seeded from their member record)
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initialProfile,
    skills: [...initialProfile.skills],
    interests: [...initialProfile.interests],
    emailPublic: !!initialProfile.email, // they have an email shared by default
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
      const fresh = result.value;
      setEvents(fresh.events);
      setCircles(fresh.circles);
      setMembers(fresh.members);
      setResources(fresh.resources);
      setRsvpState(ownFlags(fresh.events, (e) => e.rsvps.includes(currentUserId)));
      setVoteState(ownFlags(fresh.events, (e) => !!e.votes?.includes(currentUserId)));
      // whether their email shows isn't stored on the server
      setProfile((p) => ({ ...fresh.profile, emailPublic: p.emailPublic }));
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
  // and who starts out attending/voting, so this waits for it and returns the
  // created event for the caller to navigate to
  async function createEvent(draft: EventDraft): Promise<{ ok: true; event: Event } | { ok: false; error: string }> {
    const result = await dbCreateEvent(draft);
    if (!result.ok) return result;
    const ev = result.value;
    setEvents((prev) => [...prev, ev]);
    if (ev.rsvps.includes(currentUserId)) setRsvpState((prev) => ({ ...prev, [ev.id]: true })); // creator is attending
    if (ev.votes && ev.votes.includes(currentUserId)) setVoteState((prev) => ({ ...prev, [ev.id]: true })); // proposer's first vote
    const circle = circles.find((c) => c.id === ev.circleId);
    const hostCircle = ev.hostCircleId ? circles.find((c) => c.id === ev.hostCircleId) : undefined;
    if (isProposal(ev)) {
      // only the host circle can see it until it's approved
      const noun = hostCircle?.type === "neighborhood" ? "residents" : "members";
      showToast({
        tone: "success",
        title: "Event proposed",
        message: `Only ${noun} of ${hostCircle?.name ?? "the circle"} can see it for now. Once a majority approves it, it opens to ${circle ? audienceLabel(circle) : "its circle"}.`,
      });
    } else if (ev.kind === "meeting") {
      // "residents" reads naturally for a neighborhood; any other circle just
      // has "members" — see lib/governance.util.ts's votingMemberNoun for the same
      // distinction.
      const noun = circle?.type === "neighborhood" ? "residents" : "members";
      showToast({
        tone: "success",
        title: "Meeting proposed",
        message: `Your meeting has been proposed. All ${circle ? `${noun} of ${circle.name}` : "members"} will be notified and can vote to approve it.`,
      });
    } else {
      // the circle is the audience: only its members (everyone, for the city)
      // can see the event. "RSVPs are open" would be wrong for a role-slotted
      // event (see lib/roles.util.ts), so the message stays agnostic to which
      // one this event actually uses.
      showToast({
        tone: "success",
        title: "Event created",
        message: `${ev.title} is on the calendar for ${circle && circle.parentId !== null ? `members of ${circle.name}` : "everyone"}.`,
      });
    }
    return { ok: true, event: ev };
  }

  // save edits to an event's own details (title/date/location/slots/etc.) from
  // the edit-event form — organizer only, enforced by the server; the circle,
  // kind, rsvps and votes aren't editable here (toggleRsvp/toggleVote own those)
  async function updateEventDetails(id: string, details: EventDetails): Promise<MutationResult> {
    const result = await dbUpdateEventDetails(id, details);
    if (!result.ok) return result;
    setEvents((prev) => prev.map((e) => (e.id === id ? result.value : e)));
    showToast({
      tone: "success",
      title: "Changes saved",
      message: "Your edits are now live for everyone who can see this event.",
    });
    return { ok: true };
  }

  // await-then-update: the server decides between keeping it, cancelled, for the
  // people who were going, and deleting it outright when no one else was
  async function cancelEvent(id: string): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
    const result = await dbCancelEvent(id).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    if (result.value.deleted) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      const drop = (prev: Record<string, boolean>) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id));
      setRsvpState(drop);
      setVoteState(drop);
      showToast({ tone: "success", title: "Event deleted", message: "No one else was going, so it's been removed." });
    } else {
      const cancelled = result.value.event;
      setEvents((prev) => prev.map((e) => (e.id === id ? cancelled : e)));
      showToast({ tone: "success", title: "Event cancelled", message: "Everyone who was going is being emailed." });
    }
    return { ok: true, deleted: result.value.deleted };
  }

  // voting on a meeting and RSVPing to it are the same act — meetings are
  // approved by member participation, so there's no "voted but not coming"
  // state. Kept as one function (not a separate toggleRsvp call alongside this
  // one) so both arrays update atomically. A vote on a circle-hosted proposal
  // is an approval only (attending opens once it's live), and the vote that
  // reaches a majority flips it live — the server decides that for real; this
  // just mirrors the same rule so the UI doesn't wait on it.
  function toggleVote(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const hosted = !!event.hostCircleId;
    if (hosted && !isProposal(event)) return; // already approved — nothing left to vote on
    const wasVoted = !!voteState[eventId];
    const wasGoing = !!rsvpState[eventId];
    const has = (event.votes || []).includes(currentUserId);
    const willVote = !has;
    const votes = has ? (event.votes || []).filter((id) => id !== currentUserId) : [...(event.votes || []), currentUserId];
    // a meeting's vote is also your RSVP; a proposal's isn't
    const hasRsvp = event.rsvps.includes(currentUserId);
    const rsvps = hosted ? event.rsvps : willVote ? (hasRsvp ? event.rsvps : [...event.rsvps, currentUserId]) : event.rsvps.filter((id) => id !== currentUserId);
    const approvedNow = hosted && willVote && votes.length >= voteThreshold(event, indexCircles(circles));

    setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, votes, rsvps, ...(approvedNow ? { proposed: false } : {}) } : ev)));
    setVoteState((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
    if (!hosted) {
      setRsvpState((prev) => {
        const next = { ...prev, [eventId]: willVote };
        if (!willVote) delete next[eventId];
        return next;
      });
    }
    void syncEvent(eventId, () => dbSetVote(eventId, willVote), () => {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? event : e)));
      setVoteState((prev) => ({ ...prev, [eventId]: wasVoted }));
      if (!hosted) {
        setRsvpState((prev) => {
          const next = { ...prev, [eventId]: wasGoing };
          if (!wasGoing) delete next[eventId];
          return next;
        });
      }
    });
    if (approvedNow) {
      const audience = circles.find((c) => c.id === event.circleId);
      showToast({
        tone: "success",
        title: "Event approved",
        message: `${event.title} is now open to ${audience ? audienceLabel(audience) : "its circle"}.`,
      });
    }
  }

  // replace a circle's roles. Awaits the server, which checks the caller is a
  // member of the circle and decides the final list, then adopts what it saved;
  // no toast, since it's saved along with the rest of the Manage form
  async function saveCircleRoles(circleId: string, roles: CircleRoleDraft[]): Promise<MutationResult> {
    const result = await dbSaveCircleRoles(circleId, roles);
    if (!result.ok) return result;
    setCircles((prev) => prev.map((c) => (c.id === circleId ? { ...c, roles: result.value } : c)));
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
  function saveProfile(next: Profile) {
    // the photo isn't part of this save (see savePhoto), and may have just
    // changed since the form's draft was copied
    setProfile((p) => ({ ...next, photoVersion: p.photoVersion }));
    setMembers((prev) =>
      prev.map((m) =>
        m.id === next.id
          ? { ...m, name: next.name, lastName: next.lastName, pronouns: next.pronouns, role: next.role, skills: next.skills, interests: next.interests, bio: next.bio, email: next.email }
          : m
      )
    );
    // see saveCircle above — asMember never rejects, so the result is what
    // tells us whether it actually saved
    dbUpdateMember(next).then((result) => {
      if (!result.ok) console.error(result.error);
    });
    showToast({ tone: "success", title: "Changes saved", message: "Your details have been updated." });
  }

  // await-then-update, like the resources below: the server can refuse the
  // file, and the new photo's URL depends on the version it assigns. No toast
  // of its own — the Edit Myself page follows it with saveProfile's.
  async function savePhoto(photo: Blob): Promise<MutationResult> {
    const form = new FormData();
    form.set("photo", photo);
    const result = await dbUpdateMemberPhoto(form).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again." }));
    if (!result.ok) return result;
    const photoVersion = result.value;
    setProfile((p) => ({ ...p, photoVersion }));
    setMembers((prev) => prev.map((m) => (m.id === profile.id ? { ...m, photoVersion } : m)));
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

  // circles aren't filtered by the viewer's own neighborhood — the Circles
  // page nests every neighborhood at the city root specifically so any
  // neighborhood's whole subtree can be browsed into, not just the viewer's
  // home one. Home's own "Local circles"/"My circles" cards narrow to the
  // viewer's neighborhood themselves (see home.page.tsx), independent of this
  // array.

  return (
    <AppStateContext.Provider
      value={{
        events, circles, members, resources, rsvpState, voteState, profile,
        toggleRsvp: tracked(toggleRsvp),
        toggleRoleSlot: tracked(toggleRoleSlot),
        createEvent: tracked(createEvent),
        updateEventDetails: tracked(updateEventDetails),
        cancelEvent: tracked(cancelEvent),
        toggleVote: tracked(toggleVote),
        saveCircle: tracked(saveCircle),
        saveCircleRoles: tracked(saveCircleRoles),
        saveProfile: tracked(saveProfile),
        savePhoto: tracked(savePhoto),
        addResource: tracked(addResource),
        updateResource: tracked(updateResource),
        removeResource: tracked(removeResource),
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
