"use client";

import { AgendaSection } from "./agenda-section";
import { AttendeesSection } from "./attendees-section";
import { CancelledBanner } from "./cancelled-banner";
import { PageContainer } from "@/components/shared";
import { EventDetailsSection } from "./event-details-section";
import { EventMasthead } from "./event-masthead";
import { HostRsvpRow } from "./host-rsvp-row";

import { RoleSlotsSection } from "./role-slots-section";
import { ShiftStatusBanner } from "./shift-status-banner";
import { VoteBanner } from "./vote-banner";
import { isMeeting, isVoting } from "@/lib/governance.util";
import type { Circle, Event, Member, Profile } from "@/lib/types";

interface EventPageProps {
  event: Event;
  profile: Profile;
  rsvpState: Record<string, boolean>;
  toggleRsvp: (eventId: string) => void;
  voteState: Record<string, boolean>;
  toggleVote: (eventId: string) => void;
  onOpenMember: (m: Member) => void;
  onOpenCircle: (c: Circle) => void;
  onToggleRoleSlot: (eventId: string, roleKey: string) => void;
}

/* The event detail page — composed from the sections below, each of which
   is self-sufficient given the event and the viewer's profile (they derive
   their own eligibility/visibility rules from lib/governance.util and
   lib/roles.util rather than taking a dozen precomputed booleans as props).
   This shell only owns cross-cutting app state (rsvp/vote toggles) and the
   top-level "which panel applies to this event kind" decisions. */
export function EventPage({ event: e, profile, rsvpState, toggleRsvp, voteState, toggleVote, onOpenMember, onOpenCircle, onToggleRoleSlot }: EventPageProps) {

  return (
    <PageContainer size="normal">
      <EventMasthead event={e} />

      <CancelledBanner event={e} />

      {isVoting(e) && (
        <VoteBanner event={e} voted={voteState[e.id]} onToggleVote={() => toggleVote(e.id)} />
      )}

      {!e.cancelled && <ShiftStatusBanner event={e} />}

      <HostRsvpRow
        event={e}
        going={rsvpState[e.id]}
        attendeeCount={e.rsvps.length}
        onOpenCircle={onOpenCircle}
        onOpenMember={onOpenMember}
        onToggleRsvp={() => toggleRsvp(e.id)}
      />

      {/* a meeting has its agenda where another event has its description */}
      {isMeeting(e) ? <AgendaSection event={e} /> : <EventDetailsSection event={e} />}

      <RoleSlotsSection event={e} profile={profile} onToggleRoleSlot={onToggleRoleSlot} onOpenMember={onOpenMember} />

      <AttendeesSection event={e} profile={profile} onOpenMember={onOpenMember} />
    </PageContainer>
  );
}
