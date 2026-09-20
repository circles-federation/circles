"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useToast } from "@/components/shared";
import { indexCircles } from "@/lib/circles.util";
import {
  createEventAction as dbCreateEvent,
  updateCircleAction as dbUpdateCircle,
  updateEventAction as dbUpdateEvent,
  updateMemberAction as dbUpdateMember,
} from "@/lib/db/actions";
import { isEventCircleMember, isExclusive } from "@/lib/governance.util";
import type { Circle, Event, Member, Profile } from "@/lib/types";

export interface AppStateValue {
  events: Event[];
  circles: Circle[];
  members: Member[];
  rsvpState: Record<string, boolean>;
  voteState: Record<string, boolean>;
  profile: Profile;
  toggleRsvp(eventId: string): void;
  toggleRoleSlot(eventId: string, roleKey: string): void;
  createEvent(ev: Event): Event;
  updateEventDetails(id: string, patch: Partial<Event>): void;
  toggleVote(eventId: string): void;
  saveCircle(id: string, patch: Partial<Circle>): void;
  saveProfile(next: Profile): void;
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
   only a console.error on a rejected write. */
const AppStateContext = createContext<AppStateValue | null>(null);

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
  initialProfile: Member;
}

export function AppStateProvider({ children, currentUserId, initialEvents, initialCircles, initialMembers, initialProfile }: AppStateProviderProps) {
  const { showToast } = useToast();
  // events live in state so newly created ones appear instantly
  const [events, setEvents] = useState<Event[]>(() => initialEvents.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) })));
  // circles live in state so member edits (bio, offers) persist; seeded from the DAL fetch
  const [circles, setCircles] = useState<Circle[]>(() => initialCircles.map((c) => ({ ...c, offers: [...c.offers], members: [...c.members] })));
  // the roster, so names/avatars/home circles resolve from live data rather
  // than a static seed array; the signed-in member's own edits are mirrored in
  const [members, setMembers] = useState<Member[]>(initialMembers);
  // rsvpState: { [eventId]: true } — the current user's own RSVPs, persisted across routes
  const [rsvpState, setRsvpState] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce<Record<string, boolean>>((acc, e) => {
      if (e.rsvps.includes(currentUserId)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // voteState: { [eventId]: true } — the current user's votes on meetings
  const [voteState, setVoteState] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce<Record<string, boolean>>((acc, e) => {
      if (e.votes && e.votes.includes(currentUserId)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // the current user's own editable profile (seeded from their member record)
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initialProfile,
    skills: [...initialProfile.skills],
    interests: [...initialProfile.interests],
    emailPublic: !!initialProfile.email, // they have an email shared by default
  }));

  function toggleRsvp(eventId: string) {
    const willGo = !rsvpState[eventId];
    setRsvpState((prev) => {
      const next = { ...prev, [eventId]: willGo };
      if (!willGo) delete next[eventId];
      return next;
    });
    // keep the event's rsvp list in sync immutably so counts & rosters agree
    // across views. Computed from `events` (already in scope) rather than
    // inside the setEvents updater below — a value a functional updater
    // assigns isn't available synchronously afterward (React doesn't run it
    // inline), so reading it on the next line here would always see the
    // updater's *initial* value, not what it computed. See saveCircle/
    // saveProfile below for the same already-correct pattern.
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const has = event.rsvps.includes(currentUserId);
    const nextRsvps =
      willGo && !has ? [...event.rsvps, currentUserId] : !willGo && has ? event.rsvps.filter((id) => id !== currentUserId) : event.rsvps;
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, rsvps: nextRsvps } : e)));
    dbUpdateEvent(eventId, { rsvps: nextRsvps }).catch(console.error);
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
    dbUpdateEvent(eventId, { roles: nextRoles }).catch(console.error);
  }

  // returns the created event so the caller can navigate to it
  function createEvent(ev: Event): Event {
    setEvents((prev) => [...prev, ev]);
    dbCreateEvent(ev).catch(console.error);
    setRsvpState((prev) => ({ ...prev, [ev.id]: true })); // creator is attending
    if (ev.votes && ev.votes.includes(currentUserId)) {
      setVoteState((prev) => ({ ...prev, [ev.id]: true })); // proposer's first vote
    }
    if (ev.kind === "meeting") {
      const circle = circles.find((c) => c.id === ev.circleId);
      // "residents" reads naturally for a neighborhood; any other circle just
      // has "members" — see lib/governance.util.ts's scopeNoun for the same
      // distinction.
      const noun = circle?.type === "neighborhood" ? "residents" : "members";
      showToast({
        tone: "success",
        title: "Meeting proposed",
        message: `Your meeting has been proposed. All ${circle ? `${noun} of ${circle.name}` : "members"} will be notified and can vote to confirm it.`,
      });
    } else {
      // "RSVPs are open" would be wrong for a role-slotted event (see
      // lib/roles.util.ts) — it's signups, not a plain RSVP list — so the
      // message stays agnostic to which one this event actually uses.
      showToast({
        tone: "success",
        title: "Event created",
        message: `${ev.title} is on the calendar.`,
      });
    }
    return ev;
  }

  // save edits to an event's own details (title/circle/date/location/etc.)
  // from the edit-event form — deliberately doesn't touch governance state
  // (votes/rsvps), which toggleVote/toggleRsvp own instead.
  function updateEventDetails(id: string, patch: Partial<Event>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    dbUpdateEvent(id, patch).catch(console.error);
    showToast({
      tone: "success",
      title: "Changes saved",
      message: "Your edits are now live for everyone to see.",
    });
  }

  // voting on a meeting and RSVPing to it are the same act — meetings are
  // confirmed by member participation, so there's no "voted but not coming"
  // state. Kept as one function (not a separate toggleRsvp call alongside this
  // one) so both arrays update atomically.
  function toggleVote(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const has = (event.votes || []).includes(currentUserId);
    const willAttend = !has;
    const votes = has ? (event.votes || []).filter((id) => id !== currentUserId) : [...(event.votes || []), currentUserId];
    const hasRsvp = event.rsvps.includes(currentUserId);
    const rsvps = willAttend ? (hasRsvp ? event.rsvps : [...event.rsvps, currentUserId]) : event.rsvps.filter((id) => id !== currentUserId);
    const votedPatch: Partial<Event> = { votes, rsvps };

    setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, ...votedPatch } : ev)));
    dbUpdateEvent(eventId, votedPatch).catch(console.error);
    setVoteState((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
    setRsvpState((prev) => {
      const next = { ...prev, [eventId]: willAttend };
      if (!willAttend) delete next[eventId];
      return next;
    });
  }

  // save edits to a circle and record who edited it and when
  function saveCircle(id: string, patch: Partial<Circle>) {
    const fullPatch: Partial<Circle> = { ...patch, lastEditedBy: currentUserId, lastEditedAt: new Date().toISOString() };
    setCircles((prev) => prev.map((c) => (c.id === id ? { ...c, ...fullPatch } : c)));
    dbUpdateCircle(id, fullPatch).catch(console.error);
    const circle = circles.find((c) => c.id === id);
    showToast({
      tone: "success",
      title: "Changes saved",
      message: `Your edits to ${circle ? circle.name : "the circle"} are now live for everyone to see.`,
    });
  }

  // save edits from the Edit Myself page back to the profile
  function saveProfile(next: Profile) {
    setProfile(next);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === next.id
          ? { ...m, name: next.name, lastName: next.lastName, pronouns: next.pronouns, role: next.role, skills: next.skills, interests: next.interests, bio: next.bio, email: next.email }
          : m
      )
    );
    dbUpdateMember(currentUserId, next).catch(console.error);
    showToast({ tone: "success", title: "Changes saved", message: "Your details have been updated." });
  }

  // filtered here, at the single source every route reads events from, so the
  // rule applies everywhere at once (event lists, dashboards, and the
  // /events/[id] route, which 404s for an event filtered out here since it
  // reads from this same array): a members-only event is invisible to anyone
  // outside its circle, not just un-RSVP-able — the circle's privacy is the
  // point, not just its guest list
  const circlesById = indexCircles(circles);
  const visibleEvents = events.filter((e) => !(isExclusive(e) && !isEventCircleMember(e, profile, circlesById)));

  // circles aren't filtered by the viewer's own neighborhood — the Circles
  // page nests every neighborhood at the city root specifically so any
  // neighborhood's whole subtree can be browsed into, not just the viewer's
  // home one. Home's own "Local circles"/"My circles" cards narrow to the
  // viewer's neighborhood themselves (see home.page.tsx), independent of this
  // array.

  return (
    <AppStateContext.Provider
      value={{
        events: visibleEvents, circles, members, rsvpState, voteState, profile,
        toggleRsvp, toggleRoleSlot, createEvent, updateEventDetails, toggleVote,
        saveCircle, saveProfile,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
