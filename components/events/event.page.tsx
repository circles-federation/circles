"use client";

import { AttendeesSection } from "./attendees-section";
import { BackButton, PageContainer } from "@/components/shared";
import { EventDetailsSection } from "./event-details-section";
import { EventMasthead } from "./event-masthead";
import { HostRsvpRow } from "./host-rsvp-row";
import { MeetingVoteBanner } from "./meeting-vote-banner";
import { RoleSlotsSection } from "./role-slots-section";
import { ShiftStatusBanner } from "./shift-status-banner";
import { kindOf } from "@/lib/governance.util";
import type { Circle, Event, Member, Profile } from "@/lib/types";

interface EventPageProps {
  event: Event;
  profile: Profile;
  rsvpState: Record<string, boolean>;
  toggleRsvp: (eventId: string) => void;
  voteState: Record<string, boolean>;
  toggleVote: (eventId: string) => void;
  onBack: () => void;
  backLabel?: string;
  onOpenMember: (m: Member) => void;
  onOpenCircle: (c: Circle) => void;
  onToggleRoleSlot: (eventId: string, roleKey: string) => void;
  onEditEvent: () => void;
}

/* The event detail page — composed from the sections below, each of which
   is self-sufficient given the event and the viewer's profile (they derive
   their own eligibility/visibility rules from lib/governance.util and
   lib/roles.util rather than taking a dozen precomputed booleans as props).
   This shell only owns cross-cutting app state (rsvp/vote toggles) and the
   top-level "which panel applies to this event kind" decisions. */
export function EventPage({ event: e, profile, rsvpState, toggleRsvp, voteState, toggleVote, onBack, backLabel, onOpenMember, onOpenCircle, onToggleRoleSlot, onEditEvent }: EventPageProps) {
  const gov = kindOf(e).governance;

  return (
    <PageContainer size="normal">
      <BackButton onClick={onBack}>{backLabel || "All events"}</BackButton>

      <EventMasthead event={e} profile={profile} onEdit={onEditEvent} />

      {gov && (
        <MeetingVoteBanner event={e} voted={voteState[e.id]} onToggleVote={() => toggleVote(e.id)} />
      )}

      <ShiftStatusBanner event={e} />

      <HostRsvpRow
        event={e}
        going={rsvpState[e.id]}
        attendeeCount={e.rsvps.length}
        onOpenCircle={onOpenCircle}
        onOpenMember={onOpenMember}
        onToggleRsvp={() => toggleRsvp(e.id)}
      />

      <EventDetailsSection event={e} />

      <RoleSlotsSection event={e} profile={profile} onToggleRoleSlot={onToggleRoleSlot} onOpenMember={onOpenMember} />

      <AttendeesSection event={e} profile={profile} onOpenMember={onOpenMember} />
    </PageContainer>
  );
}
