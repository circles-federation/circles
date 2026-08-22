"use client";

import { AssemblyVoteBanner } from "./assembly-vote-banner";
import { AttendeesSection } from "./attendees-section";
import { BackButton } from "@/components/chrome/back-button";
import { CouncilEndorsementPanel } from "./council-endorsement-panel";
import { EventDetailsSection } from "./event-details-section";
import { EventMasthead } from "./event-masthead";
import { ExclusiveNotice } from "./exclusive-notice";
import { HostRsvpRow } from "./host-rsvp-row";
import { PastCouncilSummary } from "./past-council-summary";
import { ProposeCouncilPanel } from "./propose-council-panel";
import { RoleSlotsSection } from "./role-slots-section";
import { ShiftStatusBanner } from "./shift-status-banner";
import { FEDERATION_COUNCIL_ENABLED } from "@/lib/feature-flags";
import { isPastEvent } from "@/lib/format.util";
import { isConfirmed, kindOf } from "@/lib/governance.util";

/* The event detail page — composed from the sections below, each of which
   is self-sufficient given the event and the viewer's profile (they derive
   their own eligibility/visibility rules from lib/governance.util and
   lib/roles.util rather than taking a dozen precomputed booleans as props).
   This shell only owns cross-cutting app state (rsvp/vote toggles, the
   confirmed-assembly's council proposals) and the top-level "which panel
   applies to this event kind" decisions. */
export function EventPage({ event: e, events, profile, councilProposals, rsvpState, toggleRsvp, voteState, toggleVote, onBack, backLabel, onOpenMember, onOpenOrg, onOpenEvent, onToggleRoleSlot, onProposeCouncil, onRatifyProposal, onProposeEndorsingAssembly }) {
  const gov = kindOf(e).governance;
  const isAssembly = e.kind === "assembly";
  const isCouncil = e.kind === "council";
  const confirmed = isConfirmed(e);
  const past = isPastEvent(e);
  // this assembly's own council proposals (drafts + ratified)
  const myProposals = (councilProposals || []).filter((p) => p.assemblyId === e.id);

  return (
    <div className="mx-auto max-w-220 px-6 pt-7 pb-20">
      <BackButton onClick={onBack}>{backLabel || "All events"}</BackButton>

      <EventMasthead event={e} events={events} onOpenEvent={onOpenEvent} />

      {gov && !isCouncil && (
        <AssemblyVoteBanner event={e} profile={profile} voted={voteState[e.id]} onToggleVote={() => toggleVote(e.id)} />
      )}

      {isCouncil && past && <PastCouncilSummary event={e} />}

      {isAssembly && confirmed && !past && FEDERATION_COUNCIL_ENABLED && (
        <ProposeCouncilPanel
          event={e}
          profile={profile}
          proposals={myProposals}
          events={events}
          onProposeCouncil={onProposeCouncil}
          onRatifyProposal={onRatifyProposal}
          onOpenEvent={onOpenEvent}
        />
      )}

      {isCouncil && !past && (
        <CouncilEndorsementPanel event={e} profile={profile} onProposeEndorsingAssembly={onProposeEndorsingAssembly} />
      )}

      <ShiftStatusBanner event={e} />

      <HostRsvpRow
        event={e}
        profile={profile}
        going={rsvpState[e.id]}
        attendeeCount={e.rsvps.length}
        onOpenOrg={onOpenOrg}
        onOpenMember={onOpenMember}
        onToggleRsvp={() => toggleRsvp(e.id)}
      />

      <ExclusiveNotice event={e} profile={profile} />

      <EventDetailsSection event={e} profile={profile} />

      <RoleSlotsSection event={e} profile={profile} onToggleRoleSlot={onToggleRoleSlot} onOpenMember={onOpenMember} />

      <AttendeesSection event={e} profile={profile} onOpenMember={onOpenMember} />
    </div>
  );
}
