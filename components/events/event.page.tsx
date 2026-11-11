"use client";

import { AgendaSection } from "./agenda-section";
import { AttendeesSection } from "./attendees-section";
import { CancelledBanner } from "./cancelled-banner";
import { PageContainer } from "@/components/shared";
import { EventDetailsSection } from "./event-details-section";
import { EventMasthead } from "./event-masthead";
import { HostRsvpRow } from "./host-rsvp-row";

import { MeetingSessionSection } from "./meeting-session-section";
import { RoleSlotsSection } from "./role-slots-section";
import { useEventSharing } from "./event-sharing";
import { ShiftStatusBanner } from "./shift-status-banner";
import { ArrowUpTrayIcon, CalendarDaysIcon, LinkSlashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useTopBarMenu } from "@/components/providers/top-bar-action-provider";
import type { TopBarMenuItem } from "@/components/shared";
import { indexCircles } from "@/lib/circles.util";
import { isPastEvent } from "@/lib/format.util";
import { isAttending } from "@/lib/events.util";
import { useEventEnded } from "@/lib/hooks";
import { awaitingConsent, canManageEvent, isMeeting } from "@/lib/governance.util";
import { useAppState } from "@/components/providers/app-state-provider";
import { ProposalBanner } from "@/components/circles/proposal-banner";
import type { Circle, Event, Member, Profile } from "@/lib/types";

interface EventPageProps {
  event: Event;
  profile: Profile;
  rsvpState: Record<string, boolean>;
  toggleRsvp: (eventId: string) => void;
  onOpenMember: (m: Member) => void;
  onOpenCircle: (c: Circle) => void;
  onToggleRoleSlot: (eventId: string, roleKey: string) => void;
}

/* The event detail page — composed from the sections below, each of which
   is self-sufficient given the event and the viewer's profile (they derive
   their own eligibility/visibility rules from lib/governance.util and
   lib/roles.util rather than taking a dozen precomputed booleans as props).
   This shell only owns cross-cutting app state (RSVP toggles) and the
   top-level "which panel applies to this event kind" decisions. */
export function EventPage({ event: e, profile, rsvpState, toggleRsvp, onOpenMember, onOpenCircle, onToggleRoleSlot }: EventPageProps) {
  // no calendar copy of an event that's already over
  const ended = useEventEnded(e);
  // a meeting or circle-hosted event its circle is still deciding: its proposal
  const { proposals, circles } = useAppState();
  const proposal = awaitingConsent(e) ? proposals.find((p) => p.eventId === e.id && p.status === "open") : undefined;

  /* The top bar's menu. Edit, for whoever manages it, until it's cancelled
     or over, or while its circle is still deciding it (what's proposed is
     what's consented to). Share: anyone may send a live, decided event to
     someone without an account; a meeting stays with its circle. Add to
     calendar, which can be chosen once you're going: the phone offers to add the file
     (app/api/events/[id]/calendar), but not while its circle is deciding it,
     since consenting marks you going and it may never be held. */
  const live = !e.cancelled && !ended && !awaitingConsent(e);
  const canEdit = canManageEvent(e, profile, indexCircles(circles)) && !e.cancelled && !isPastEvent(e) && !awaitingConsent(e);
  const sharing = useEventSharing(e.id, e.title, live && !isMeeting(e));
  const menu: TopBarMenuItem[] = [];
  if (canEdit) menu.push({ label: "Edit", href: `/events/${e.id}/edit`, icon: PencilIcon });
  if (live && !isMeeting(e)) {
    menu.push({ label: "Share", icon: ArrowUpTrayIcon, onSelect: sharing.share });
    if (sharing.stop) menu.push({ label: "Stop sharing", icon: LinkSlashIcon, onSelect: sharing.stop });
  }
  // shown before you're going, but only to be chosen once you are
  if (live) menu.push({ label: "Add to calendar", href: `/api/events/${e.id}/calendar`, file: true, icon: CalendarDaysIcon, disabled: !(isAttending(e, profile.id) || rsvpState[e.id]) });
  useTopBarMenu(menu);

  return (
    <PageContainer size="normal">
      <EventMasthead event={e} />

      <CancelledBanner event={e} />

      {proposal && <ProposalBanner proposal={proposal} memberId={profile.id} className="mt-6" />}


      {!e.cancelled && <ShiftStatusBanner event={e} />}

      <HostRsvpRow
        event={e}
        going={rsvpState[e.id]}
        attendeeCount={e.rsvps.length + (e.guests?.length ?? 0)}
        onOpenCircle={onOpenCircle}
        onOpenMember={onOpenMember}
        onToggleRsvp={() => toggleRsvp(e.id)}
      />

      {sharing.dialogs}

      {isMeeting(e) && <MeetingSessionSection event={e} />}

      {/* a meeting has its agenda where another event has its description */}
      {isMeeting(e) ? <AgendaSection event={e} /> : <EventDetailsSection event={e} />}

      <RoleSlotsSection event={e} profile={profile} onToggleRoleSlot={onToggleRoleSlot} onOpenMember={onOpenMember} />

      <AttendeesSection event={e} profile={profile} onOpenMember={onOpenMember} />
    </PageContainer>
  );
}
