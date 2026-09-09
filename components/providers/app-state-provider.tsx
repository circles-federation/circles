"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useToast } from "@/components/shared";
import { COUNCIL_RATIFY_THRESHOLD } from "@/lib/data";
import {
  createCouncilProposal as dbCreateCouncilProposal,
  createEvent as dbCreateEvent,
  updateCouncilProposal as dbUpdateCouncilProposal,
  updateEvent as dbUpdateEvent,
} from "@/lib/db/events";
import { updateMember as dbUpdateMember } from "@/lib/db/members";
import { updateOrg as dbUpdateOrg } from "@/lib/db/orgs";
import { FEDERATION_COUNCIL_ENABLED } from "@/lib/feature-flags";
import { isExclusive, isHostOrgMember, meetingThreshold } from "@/lib/governance.util";
import { orgDisplayName } from "@/lib/orgs.util";
import type { CouncilProposal, Event, Member, Org, ProposalDetails, Profile } from "@/lib/types";

export interface AppStateValue {
  events: Event[];
  orgs: Org[];
  councilProposals: CouncilProposal[];
  rsvpState: Record<string, boolean>;
  voteState: Record<string, boolean>;
  profile: Profile;
  toggleRsvp(eventId: string): void;
  toggleRoleSlot(eventId: string, roleKey: string): void;
  createEvent(ev: Event): Event;
  updateEventDetails(id: string, patch: Partial<Event>): void;
  proposeCouncilDraft(assembly: Event, details: ProposalDetails): void;
  ratifyCouncilProposal(proposalId: string): void;
  proposeEndorsingAssembly(council: Event, details: ProposalDetails, hood: string): Event;
  toggleVote(eventId: string): void;
  saveOrg(id: string, patch: Partial<Org>): void;
  saveProfile(next: Profile): void;
}

/* Holds the app's entire "database" — events, orgs, the current user's RSVPs/
   votes/profile, and pending council proposals — plus the mutations on it.
   There's no backend, so this is the single source of truth every route reads
   from instead of a fetch. Mounted once in the (app) layout, seeded from data
   the DAL (lib/db/) fetched server-side — see that layout for the fetch.

   Mutators here are pure state + toast — they never navigate. Where the
   original single-view app followed a mutation with a view change, that's now
   the calling route's job (it has the router; this provider shouldn't).
   Each mutator also calls the matching lib/db/ write, fire-and-forget — no
   rollback/error-handling yet, since the mock DAL can't actually fail. */
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
  initialOrgs: Org[];
  initialProfile: Member;
}

export function AppStateProvider({ children, currentUserId, initialEvents, initialOrgs, initialProfile }: AppStateProviderProps) {
  const { showToast } = useToast();
  // events live in state so newly created ones appear instantly
  const [events, setEvents] = useState<Event[]>(() => initialEvents.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) })));
  // orgs live in state so member edits (bio, offers) persist; seeded from the DAL fetch
  const [orgs, setOrgs] = useState<Org[]>(() => initialOrgs.map((o) => ({ ...o, offers: [...o.offers], members: [...o.members] })));
  // council proposals drafted on an assembly page, awaiting that assembly's
  // ratification before they become federation-wide proposed councils. they do
  // not appear anywhere events are listed until ratified.
  const [councilProposals, setCouncilProposals] = useState<CouncilProposal[]>([]);
  // rsvpState: { [eventId]: true } — the current user's own RSVPs, persisted across routes
  const [rsvpState, setRsvpState] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce<Record<string, boolean>>((acc, e) => {
      if (e.rsvps.includes(currentUserId)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // voteState: { [eventId]: true } — the current user's votes on governance proposals
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
    // keep the event's rsvp list in sync immutably so counts & rosters agree across views
    let nextRsvps: number[] | null = null;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        const has = e.rsvps.includes(currentUserId);
        if (willGo && !has) nextRsvps = [...e.rsvps, currentUserId];
        else if (!willGo && has) nextRsvps = e.rsvps.filter((id) => id !== currentUserId);
        else nextRsvps = e.rsvps;
        return { ...e, rsvps: nextRsvps };
      })
    );
    if (nextRsvps) dbUpdateEvent(eventId, { rsvps: nextRsvps });
  }

  // join or leave a specific role slot on a slotted event (e.g. shift lead).
  // the current user may hold at most one role per event.
  function toggleRoleSlot(eventId: string, roleKey: string) {
    let nextRoles: Event["roles"] | null = null;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId || !Array.isArray(e.roles)) return e;
        nextRoles = e.roles.map((r) => {
          if (r.key === roleKey) {
            const has = r.members.includes(currentUserId);
            if (!has && r.max != null && r.members.length >= r.max) return r; // slot full — can't join
            return { ...r, members: has ? r.members.filter((id) => id !== currentUserId) : [...r.members, currentUserId] };
          }
          // leaving any other role the user might hold, so they hold one slot at a time
          return { ...r, members: r.members.filter((id) => id !== currentUserId) };
        });
        return { ...e, roles: nextRoles };
      })
    );
    if (nextRoles) dbUpdateEvent(eventId, { roles: nextRoles });
  }

  // returns the created event so the caller can navigate to it
  function createEvent(ev: Event): Event {
    setEvents((prev) => [...prev, ev]);
    dbCreateEvent(ev);
    setRsvpState((prev) => ({ ...prev, [ev.id]: true })); // creator is attending
    if (ev.votes && ev.votes.includes(currentUserId)) {
      setVoteState((prev) => ({ ...prev, [ev.id]: true })); // proposer's first vote
    }
    if (ev.kind === "meeting") {
      const org = orgs.find((o) => o.id === ev.orgId);
      // "residents" reads naturally for a Neighborhood Council; any other
      // circle (a sub-org, or another org entirely) just has "members" —
      // see lib/governance.util.ts's scopeNoun for the same distinction.
      const noun = org?.neighborhood ? "residents" : "members";
      showToast({
        tone: "success",
        title: "Meeting proposed",
        message: `Your meeting has been proposed. All ${org ? `${noun} of ${orgDisplayName(org)}` : "members"} will be notified and can vote to confirm it.`,
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

  // save edits to an event's own details (title/host/date/location/etc.)
  // from the edit-event form — deliberately doesn't touch governance state
  // (votes/rsvps/endorsements), which toggleVote/toggleRsvp own instead.
  function updateEventDetails(id: string, patch: Partial<Event>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    dbUpdateEvent(id, patch);
    showToast({
      tone: "success",
      title: "Changes saved",
      message: "Your edits are now live for everyone to see.",
    });
  }

  // a delegate drafts a council proposal on their meeting's page. it awaits
  // ratification by that meeting before becoming a federation-wide council.
  function proposeCouncilDraft(assembly: Event, details: ProposalDetails) {
    const sponsorHood = orgs.find((o) => o.id === assembly.orgId)?.neighborhood || "";
    const proposal: CouncilProposal = {
      id: "cp" + Date.now(),
      assemblyId: assembly.id,
      sponsorHood,
      sponsorName: assembly.title,
      proposedBy: currentUserId,
      title: details.title,
      date: details.date, start: details.start, end: details.end,
      location: details.location,
      agenda: details.agenda,
      ratifyVotes: [currentUserId], // proposer's own vote
      ratified: false,
      councilId: null,
    };
    setCouncilProposals((prev) => [...prev, proposal]);
    dbCreateCouncilProposal(proposal);
    showToast({
      tone: "success",
      title: "Meeting proposed",
      message: `Your federation council meeting proposal is posted to ${sponsorHood}. Attendees now vote to ratify it — ${COUNCIL_RATIFY_THRESHOLD} votes confirm the delegate's mandate.`,
    });
  }

  // attendees of the sponsoring assembly vote to ratify a draft. once it reaches
  // the assembly quorum, a real federation council event is created (proposed
  // status), endorsed by the sponsoring neighborhood.
  function ratifyCouncilProposal(proposalId: string) {
    let created: Event | null = null;
    let proposalPatch: Partial<CouncilProposal> | null = null;
    setCouncilProposals((prev) => prev.map((p) => {
      if (p.id !== proposalId || p.ratified) return p;
      const has = p.ratifyVotes.includes(currentUserId);
      const votes = has ? p.ratifyVotes.filter((id) => id !== currentUserId) : [...p.ratifyVotes, currentUserId];
      if (votes.length >= COUNCIL_RATIFY_THRESHOLD) {
        const councilId = "e" + Date.now();
        created = {
          id: councilId,
          title: p.title,
          kind: "council",
          scope: "federation",
          sponsor: { id: p.assemblyId, name: p.sponsorName, neighborhood: p.sponsorHood },
          host: { type: "member", id: p.proposedBy },
          date: p.date, start: p.start, end: p.end,
          location: p.location,
          description: p.agenda,
          endorsements: [p.sponsorHood], // sponsoring neighborhood endorses on ratification
          rsvps: [],
        };
        proposalPatch = { ratifyVotes: votes, ratified: true, councilId };
        return { ...p, ...proposalPatch };
      }
      proposalPatch = { ratifyVotes: votes };
      return { ...p, ratifyVotes: votes };
    }));
    if (proposalPatch) dbUpdateCouncilProposal(proposalId, proposalPatch);
    if (created) {
      // `created` is reassigned inside the .map() callback above; TS can't
      // carry that narrowing back out to this outer scope (it conservatively
      // keeps the pre-callback flow type here), even though the `if (created)`
      // check above is a perfectly sound runtime guard — hence the assertion.
      const confirmedEvent = created as Event;
      setEvents((prev) => [...prev, confirmedEvent]);
      dbCreateEvent(confirmedEvent);
      showToast({
        tone: "success",
        title: "Council confirmed by the meeting",
        message: `${confirmedEvent.scope} ratified the proposal. It's now a proposed federation council meeting — other neighborhoods will be notified to hold meetings of their own.`,
      });
    }
  }

  // from a proposed council, a viewer proposes a meeting in their own
  // neighborhood to decide whether to endorse the council. returns the
  // created meeting so the caller can navigate to it. (function name kept
  // as-is — the federation endorsement flow itself isn't being rebuilt in
  // this pass, only kept data-consistent with the assembly->meeting rename.)
  function proposeEndorsingAssembly(council: Event, details: ProposalDetails, hood: string): Event {
    const hoodOrg = orgs.find((o) => o.neighborhood === hood);
    const ev: Event = {
      id: "e" + Date.now(),
      title: details.title,
      kind: "meeting",
      orgId: hoodOrg ? hoodOrg.id : undefined,
      endorsesCouncilId: council.id,
      host: { type: "member", id: currentUserId },
      date: details.date, start: details.start, end: details.end,
      location: details.location,
      description: details.agenda,
      votes: [currentUserId],
      rsvps: [currentUserId],
    };
    setEvents((prev) => [...prev, ev]);
    dbCreateEvent(ev);
    setRsvpState((prev) => ({ ...prev, [ev.id]: true }));
    setVoteState((prev) => ({ ...prev, [ev.id]: true }));
    showToast({
      tone: "success",
      title: "Meeting proposed",
      message: `Your ${hood} meeting to weigh in on this council is proposed. Neighbors will be notified and can vote to confirm it.`,
    });
    return ev;
  }

  // voting on a Neighborhood Council meeting and RSVPing to it are the same
  // act — these meetings are confirmed by resident participation, so there's
  // no "voted but not coming" state. Kept as one function (not a separate
  // toggleRsvp call alongside this one) so both arrays update atomically.
  // If this meeting exists to endorse a council and just reached quorum,
  // its neighborhood's endorsement is recorded on that council too.
  function toggleVote(eventId: string) {
    let votedPatch: Partial<Event> | null = null;
    let endorsedPatch: Partial<Event> | null = null;
    let endorseCouncilId: string | null = null;
    let willAttend: boolean | null = null;
    setEvents((prev) => {
      let endorseHood: string | undefined;
      const next = prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const has = (ev.votes || []).includes(currentUserId);
        willAttend = !has;
        const votes = has ? (ev.votes || []).filter((id) => id !== currentUserId) : [...(ev.votes || []), currentUserId];
        const hasRsvp = ev.rsvps.includes(currentUserId);
        const rsvps = willAttend
          ? (hasRsvp ? ev.rsvps : [...ev.rsvps, currentUserId])
          : ev.rsvps.filter((id) => id !== currentUserId);
        votedPatch = { votes, rsvps };
        if (ev.endorsesCouncilId && votes.length >= meetingThreshold(ev)) {
          endorseCouncilId = ev.endorsesCouncilId;
          endorseHood = orgs.find((o) => o.id === ev.orgId)?.neighborhood;
        }
        return { ...ev, votes, rsvps };
      });
      if (endorseCouncilId) {
        return next.map((ev) => {
          if (ev.id === endorseCouncilId && !(ev.endorsements || []).includes(endorseHood || "")) {
            const endorsements = [...(ev.endorsements || []), endorseHood || ""];
            endorsedPatch = { endorsements };
            return { ...ev, endorsements };
          }
          return ev;
        });
      }
      return next;
    });
    if (votedPatch) dbUpdateEvent(eventId, votedPatch);
    if (endorseCouncilId && endorsedPatch) dbUpdateEvent(endorseCouncilId, endorsedPatch);
    setVoteState((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
    setRsvpState((prev) => {
      const next = { ...prev, [eventId]: !!willAttend };
      if (!willAttend) delete next[eventId];
      return next;
    });
  }

  // save edits to an org and record who edited it and when
  function saveOrg(id: string, patch: Partial<Org>) {
    const fullPatch: Partial<Org> = { ...patch, lastEditedBy: currentUserId, lastEditedAt: new Date().toISOString() };
    setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, ...fullPatch } : o)));
    dbUpdateOrg(id, fullPatch);
    const org = orgs.find((o) => o.id === id);
    showToast({
      tone: "success",
      title: "Changes saved",
      message: `Your edits to ${org ? org.name : "the organization"} are now live for everyone to see.`,
    });
  }

  // save edits from the Edit Myself page back to the profile
  function saveProfile(next: Profile) {
    setProfile(next);
    dbUpdateMember(currentUserId, next);
    showToast({ tone: "success", title: "Changes saved", message: "Your details have been updated." });
  }

  // filtered here, at the single source every route reads events from, so
  // both rules apply everywhere at once (event lists, dashboards, and the
  // /events/[id] and /events/[id]/propose routes, which 404 for an event
  // filtered out here since they read from this same array):
  // - federation council meetings are feature-flagged off by default (see
  //   lib/feature-flags.ts)
  // - a members-only event is invisible to anyone outside its hosting org,
  //   not just un-RSVP-able — the org's privacy is the point, not just its
  //   guest list
  const visibleEvents = events.filter((e) => {
    if (!FEDERATION_COUNCIL_ENABLED && e.kind === "council") return false;
    if (isExclusive(e) && !isHostOrgMember(e, profile)) return false;
    return true;
  });

  // orgs aren't filtered by the viewer's own neighborhood — the Directory
  // nests every Neighborhood Council at the federation root specifically so
  // any neighborhood's whole subtree (its own Councils and organizations)
  // can be browsed into, not just the viewer's home one. Home's own "Local
  // organizations"/"My organizations" cards narrow to the viewer's
  // neighborhood themselves (see home.page.jsx's own orgScope filter),
  // independent of this array.

  return (
    <AppStateContext.Provider
      value={{
        events: visibleEvents, orgs, councilProposals, rsvpState, voteState, profile,
        toggleRsvp, toggleRoleSlot, createEvent, updateEventDetails, proposeCouncilDraft,
        ratifyCouncilProposal, proposeEndorsingAssembly, toggleVote,
        saveOrg, saveProfile,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
