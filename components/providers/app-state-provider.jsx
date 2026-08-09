"use client";

import { createContext, useContext, useState } from "react";
import { useToast } from "@/components/chrome/toast";
import { COUNCIL_RATIFY_THRESHOLD, CURRENT_USER_ID, EVENTS, ORGS, memberById } from "@/lib/data";
import { FEDERATION_COUNCIL_ENABLED } from "@/lib/feature-flags";
import { kindOf } from "@/lib/governance.util";

/* Holds the app's entire "database" — events, orgs, the current user's RSVPs/
   votes/profile, and pending council proposals — plus the mutations on it.
   There's no backend, so this is the single source of truth every route reads
   from instead of a fetch. Mounted once in the root layout so it survives
   navigation between routes.

   Mutators here are pure state + toast — they never navigate. Where the
   original single-view app followed a mutation with a view change, that's now
   the calling route's job (it has the router; this provider shouldn't). */
const AppStateContext = createContext(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export function AppStateProvider({ children }) {
  const { showToast } = useToast();
  // events live in state so newly created ones appear instantly
  const [events, setEvents] = useState(() => EVENTS.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) })));
  // orgs live in state so member edits (bio, offers) persist; seeded from ORGS
  const [orgs, setOrgs] = useState(() => ORGS.map((o) => ({ ...o, offers: [...o.offers], members: [...o.members] })));
  // council proposals drafted on an assembly page, awaiting that assembly's
  // ratification before they become federation-wide proposed councils. they do
  // not appear anywhere events are listed until ratified.
  const [councilProposals, setCouncilProposals] = useState([]);
  // rsvpState: { [eventId]: true } — the current user's own RSVPs, persisted across routes
  const [rsvpState, setRsvpState] = useState(() =>
    EVENTS.reduce((acc, e) => {
      if (e.rsvps.includes(CURRENT_USER_ID)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // voteState: { [eventId]: true } — the current user's votes on governance proposals
  const [voteState, setVoteState] = useState(() =>
    EVENTS.reduce((acc, e) => {
      if (e.votes && e.votes.includes(CURRENT_USER_ID)) acc[e.id] = true;
      return acc;
    }, {})
  );
  // the current user's own editable profile (seeded from their member record)
  const [profile, setProfile] = useState(() => {
    const me = memberById(CURRENT_USER_ID);
    return {
      ...me,
      skills: [...me.skills],
      interests: [...me.interests],
      emailPublic: !!me.email, // they have an email shared by default
    };
  });

  function toggleRsvp(eventId) {
    setRsvpState((prev) => {
      const nextGoing = !prev[eventId];
      const next = { ...prev, [eventId]: nextGoing };
      if (!nextGoing) delete next[eventId];
      return next;
    });
    // keep the event's rsvp list in sync immutably so counts & rosters agree across views
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        const has = e.rsvps.includes(CURRENT_USER_ID);
        const willGo = !rsvpState[eventId];
        if (willGo && !has) return { ...e, rsvps: [...e.rsvps, CURRENT_USER_ID] };
        if (!willGo && has) return { ...e, rsvps: e.rsvps.filter((id) => id !== CURRENT_USER_ID) };
        return e;
      })
    );
  }

  // join or leave a specific role slot on a slotted event (e.g. shift lead).
  // the current user may hold at most one role per event.
  function toggleRoleSlot(eventId, roleKey) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId || !Array.isArray(e.roles)) return e;
        return {
          ...e,
          roles: e.roles.map((r) => {
            if (r.key === roleKey) {
              const has = r.members.includes(CURRENT_USER_ID);
              if (!has && r.max != null && r.members.length >= r.max) return r; // slot full — can't join
              return { ...r, members: has ? r.members.filter((id) => id !== CURRENT_USER_ID) : [...r.members, CURRENT_USER_ID] };
            }
            // leaving any other role the user might hold, so they hold one slot at a time
            return { ...r, members: r.members.filter((id) => id !== CURRENT_USER_ID) };
          }),
        };
      })
    );
  }

  // returns the created event so the caller can navigate to it
  function createEvent(ev) {
    setEvents((prev) => [...prev, ev]);
    setRsvpState((prev) => ({ ...prev, [ev.id]: true })); // creator is attending
    if (ev.votes && ev.votes.includes(CURRENT_USER_ID)) {
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
      proposedBy: CURRENT_USER_ID,
      title: details.title,
      date: details.date, start: details.start, end: details.end,
      location: details.location,
      agenda: details.agenda,
      ratifyVotes: [CURRENT_USER_ID], // proposer's own vote
      ratified: false,
      councilId: null,
    };
    setCouncilProposals((prev) => [...prev, proposal]);
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
    setCouncilProposals((prev) => prev.map((p) => {
      if (p.id !== proposalId || p.ratified) return p;
      const has = p.ratifyVotes.includes(CURRENT_USER_ID);
      const votes = has ? p.ratifyVotes.filter((id) => id !== CURRENT_USER_ID) : [...p.ratifyVotes, CURRENT_USER_ID];
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
        return { ...p, ratifyVotes: votes, ratified: true, councilId };
      }
      return { ...p, ratifyVotes: votes };
    }));
    if (created) {
      setEvents((prev) => [...prev, created]);
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
      host: { type: "member", id: CURRENT_USER_ID },
      date: details.date, start: details.start, end: details.end,
      location: details.location,
      description: details.agenda,
      votes: [CURRENT_USER_ID],
      rsvps: [CURRENT_USER_ID],
    };
    setEvents((prev) => [...prev, ev]);
    setRsvpState((prev) => ({ ...prev, [ev.id]: true }));
    setVoteState((prev) => ({ ...prev, [ev.id]: true }));
    showToast({
      tone: "success",
      title: "Assembly proposed",
      message: `Your ${hood} assembly to weigh in on this council is proposed. Neighbors will be notified and can vote to confirm it.`,
    });
    return ev;
  }

  // an endorsing assembly votes; if it passes quorum, its neighborhood is added
  // to the council's endorsements (one neighborhood-vote for the council).
  function toggleVote(eventId) {
    setEvents((prev) => {
      let endorseCouncil = null;
      let endorseHood = null;
      const next = prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const has = (ev.votes || []).includes(CURRENT_USER_ID);
        const votes = has ? ev.votes.filter((id) => id !== CURRENT_USER_ID) : [...(ev.votes || []), CURRENT_USER_ID];
        // if this assembly exists to endorse a council and just reached quorum,
        // record its neighborhood's endorsement on that council.
        if (ev.endorsesCouncilId && votes.length >= (kindOf(ev).threshold || 5)) {
          endorseCouncil = ev.endorsesCouncilId;
          endorseHood = ev.scope;
        }
        return { ...ev, votes };
      });
      if (endorseCouncil) {
        return next.map((ev) =>
          ev.id === endorseCouncil && !(ev.endorsements || []).includes(endorseHood)
            ? { ...ev, endorsements: [...(ev.endorsements || []), endorseHood] }
            : ev
        );
      }
      return next;
    });
    setVoteState((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  }

  // save edits to an org and record who edited it and when
  function saveOrg(id, patch) {
    setOrgs((prev) => prev.map((o) =>
      o.id === id
        ? { ...o, ...patch, lastEditedBy: CURRENT_USER_ID, lastEditedAt: new Date().toISOString() }
        : o
    ));
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
    showToast({ tone: "success", title: "Changes saved", message: "Your details have been updated." });
  }

  // federation council meetings are feature-flagged off by default (see
  // lib/feature-flags.js) — filtered here, at the single source every route
  // reads events from, so the flag applies everywhere at once: event lists,
  // dashboards, and the /events/[id] and /events/[id]/propose routes (which
  // 404 for a council event they can no longer find).
  const visibleEvents = FEDERATION_COUNCIL_ENABLED ? events : events.filter((e) => e.kind !== "council");

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
