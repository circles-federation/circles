"use client";

import { createContext, useContext, useState } from "react";
import { useToast } from "@/components/shared/toast";
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
import { isExclusive, isHostOrgMember, kindOf } from "@/lib/governance.util";

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
const AppStateContext = createContext(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export function AppStateProvider({ children, currentUserId, initialEvents, initialOrgs, initialProfile }) {
  const { showToast } = useToast();
  // events live in state so newly created ones appear instantly
  const [events, setEvents] = useState(() => initialEvents.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) })));
  // orgs live in state so member edits (bio, offers) persist; seeded from the DAL fetch
  const [orgs, setOrgs] = useState(() => initialOrgs.map((o) => ({ ...o, offers: [...o.offers], members: [...o.members] })));
  // council proposals drafted on an assembly page, awaiting that assembly's
  // ratification before they become federation-wide proposed councils. they do
  // not appear anywhere events are listed until ratified.
  const [councilProposals, setCouncilProposals] = useState([]);
  // rsvpState: { [eventId]: true } — the current user's own RSVPs, persisted across routes
  const [rsvpState, setRsvpState] = useState(() =>
    initialEvents.reduce((acc, e) => {
      if (e.rsvps.includes(currentUserId)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // voteState: { [eventId]: true } — the current user's votes on governance proposals
  const [voteState, setVoteState] = useState(() =>
    initialEvents.reduce((acc, e) => {
      if (e.votes && e.votes.includes(currentUserId)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // the current user's own editable profile (seeded from their member record)
  const [profile, setProfile] = useState(() => ({
    ...initialProfile,
    skills: [...initialProfile.skills],
    interests: [...initialProfile.interests],
    emailPublic: !!initialProfile.email, // they have an email shared by default
  }));

  function toggleRsvp(eventId) {
    const willGo = !rsvpState[eventId];
    setRsvpState((prev) => {
      const next = { ...prev, [eventId]: willGo };
      if (!willGo) delete next[eventId];
      return next;
    });
    // keep the event's rsvp list in sync immutably so counts & rosters agree across views
    let nextRsvps = null;
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
  function toggleRoleSlot(eventId, roleKey) {
    let nextRoles = null;
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
  function createEvent(ev) {
    setEvents((prev) => [...prev, ev]);
    dbCreateEvent(ev);
    setRsvpState((prev) => ({ ...prev, [ev.id]: true })); // creator is attending
    if (ev.votes && ev.votes.includes(currentUserId)) {
      setVoteState((prev) => ({ ...prev, [ev.id]: true })); // proposer's first vote
    }
    if (ev.kind === "assembly") {
      showToast({
        tone: "success",
        title: "Assembly proposed",
        message: `Your assembly has been proposed. Everyone in ${ev.scope} will be notified and can vote to confirm it.`,
      });
    }
    return ev;
  }

  // a delegate drafts a council proposal on their assembly's page. it awaits
  // ratification by that assembly before becoming a federation-wide council.
  function proposeCouncilDraft(assembly, details) {
    const proposal = {
      id: "cp" + Date.now(),
      assemblyId: assembly.id,
      sponsorHood: assembly.scope,
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
      message: `Your federation council meeting proposal is posted to ${assembly.scope}. Attendees now vote to ratify it — ${COUNCIL_RATIFY_THRESHOLD} votes confirm the delegate's mandate.`,
    });
  }

  // attendees of the sponsoring assembly vote to ratify a draft. once it reaches
  // the assembly quorum, a real federation council event is created (proposed
  // status), endorsed by the sponsoring neighborhood.
  function ratifyCouncilProposal(proposalId) {
    let created = null;
    let proposalPatch = null;
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
      setEvents((prev) => [...prev, created]);
      dbCreateEvent(created);
      showToast({
        tone: "success",
        title: "Council confirmed by the assembly",
        message: `${created.scope} ratified the proposal. It's now a proposed federation council meeting — other neighborhoods will be notified to hold assemblies of their own.`,
      });
    }
  }

  // from a proposed council, a viewer proposes an assembly in their own
  // neighborhood to decide whether to endorse the council. returns the
  // created assembly so the caller can navigate to it.
  function proposeEndorsingAssembly(council, details, hood) {
    const ev = {
      id: "e" + Date.now(),
      title: details.title,
      kind: "assembly",
      scope: hood,
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
      title: "Assembly proposed",
      message: `Your ${hood} assembly to weigh in on this council is proposed. Neighbors will be notified and can vote to confirm it.`,
    });
    return ev;
  }

  // voting on a neighborhood assembly and RSVPing to it are the same act —
  // these meetings are confirmed by resident participation, so there's no
  // "voted but not coming" state. Kept as one function (not a separate
  // toggleRsvp call alongside this one) so both arrays update atomically.
  // If this assembly exists to endorse a council and just reached quorum,
  // its neighborhood's endorsement is recorded on that council too.
  function toggleVote(eventId) {
    let votedPatch = null;
    let endorsedPatch = null;
    let endorseCouncilId = null;
    let willAttend = null;
    setEvents((prev) => {
      let endorseHood = null;
      const next = prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const has = (ev.votes || []).includes(currentUserId);
        willAttend = !has;
        const votes = has ? ev.votes.filter((id) => id !== currentUserId) : [...(ev.votes || []), currentUserId];
        const hasRsvp = ev.rsvps.includes(currentUserId);
        const rsvps = willAttend
          ? (hasRsvp ? ev.rsvps : [...ev.rsvps, currentUserId])
          : ev.rsvps.filter((id) => id !== currentUserId);
        votedPatch = { votes, rsvps };
        if (ev.endorsesCouncilId && votes.length >= (kindOf(ev).threshold || 5)) {
          endorseCouncilId = ev.endorsesCouncilId;
          endorseHood = ev.scope;
        }
        return { ...ev, votes, rsvps };
      });
      if (endorseCouncilId) {
        return next.map((ev) => {
          if (ev.id === endorseCouncilId && !(ev.endorsements || []).includes(endorseHood)) {
            const endorsements = [...(ev.endorsements || []), endorseHood];
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
      const next = { ...prev, [eventId]: willAttend };
      if (!willAttend) delete next[eventId];
      return next;
    });
  }

  // save edits to an org and record who edited it and when
  function saveOrg(id, patch) {
    const fullPatch = { ...patch, lastEditedBy: currentUserId, lastEditedAt: new Date().toISOString() };
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
  function saveProfile(next) {
    setProfile(next);
    dbUpdateMember(currentUserId, next);
    showToast({ tone: "success", title: "Changes saved", message: "Your details have been updated." });
  }

  // filtered here, at the single source every route reads events from, so
  // both rules apply everywhere at once (event lists, dashboards, and the
  // /events/[id] and /events/[id]/propose routes, which 404 for an event
  // filtered out here since they read from this same array):
  // - federation council meetings are feature-flagged off by default (see
  //   lib/feature-flags.js)
  // - a members-only event is invisible to anyone outside its hosting org,
  //   not just un-RSVP-able — the org's privacy is the point, not just its
  //   guest list
  const visibleEvents = events.filter((e) => {
    if (!FEDERATION_COUNCIL_ENABLED && e.kind === "council") return false;
    if (isExclusive(e) && !isHostOrgMember(e, profile)) return false;
    return true;
  });

  return (
    <AppStateContext.Provider
      value={{
        events: visibleEvents, orgs, councilProposals, rsvpState, voteState, profile,
        toggleRsvp, toggleRoleSlot, createEvent, proposeCouncilDraft,
        ratifyCouncilProposal, proposeEndorsingAssembly, toggleVote,
        saveOrg, saveProfile,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
