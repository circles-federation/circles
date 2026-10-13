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
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { isAttending } from "@/lib/events.util";
import { useEventEnded } from "@/lib/hooks";
import { awaitingConsent, isMeeting, isVoting } from "@/lib/governance.util";
import { useAppState } from "@/components/providers/app-state-provider";
import { ProposalBanner } from "@/components/circles/proposal-banner";
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
  // no calendar copy of an event that's already over
  const ended = useEventEnded(e);
  // a group's event its members are still deciding: its proposal, in place of a vote
  const { proposals } = useAppState();
  const proposal = awaitingConsent(e) ? proposals.find((p) => p.eventId === e.id && p.status === "open") : undefined;

  return (
    <PageContainer size="normal">
      <EventMasthead event={e} />

      <CancelledBanner event={e} />

      {proposal && <ProposalBanner proposal={proposal} memberId={profile.id} className="mt-6" />}

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

      {/* once you're going, a copy for your own calendar: the phone offers to
          add the file (app/api/events/[id]/calendar). A link styled as a
          secondary Button, since it opens a file rather than running code */}
      {!e.cancelled && !ended && isAttending(e, profile.id) && (
        <div className="border-b border-faint py-4">
          <a
            href={`/api/events/${e.id}/calendar`}
            className="ink-press inline-flex items-center justify-center gap-1.5 border border-ink bg-paper px-3.75 py-2.5 font-sans text-xs font-bold tracking-wide whitespace-nowrap text-ink uppercase no-underline"
          >
            <CalendarDaysIcon className="size-4" strokeWidth={2} />
            Add to calendar
          </a>
        </div>
      )}

      {/* a meeting has its agenda where another event has its description */}
      {isMeeting(e) ? <AgendaSection event={e} /> : <EventDetailsSection event={e} />}

      <RoleSlotsSection event={e} profile={profile} onToggleRoleSlot={onToggleRoleSlot} onOpenMember={onOpenMember} />

      <AttendeesSection event={e} profile={profile} onOpenMember={onOpenMember} />
    </PageContainer>
  );
}
