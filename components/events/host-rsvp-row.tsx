import { RsvpButton } from "./rsvp-button";
import { Avatar, Eyebrow } from "@/components/shared";
import { eventHost } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { isEventCircleMember, isExclusive, kindOf } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { hasRoles, roleShort, shiftCancelled, shiftNeedsSlots } from "@/lib/roles.util";
import type { Circle, Event, Member, Profile } from "@/lib/types";

interface HostRsvpRowProps {
  event: Event;
  profile: Profile;
  going?: boolean;
  attendeeCount: number;
  onOpenCircle: (circle: Circle) => void;
  onOpenMember: (member: Member) => void;
  onToggleRsvp: () => void;
}

/* Who's hosting/proposing this event, plus the right-side action: an RSVP
   toggle for ordinary events, a signed-up count for role-slotted
   ones, or nothing for a meeting — meetings vote to attend instead (see
   MeetingVoteBanner), so they don't get a separate RSVP control here. */
export function HostRsvpRow({ event: e, profile, going, attendeeCount, onOpenCircle, onOpenMember, onToggleRsvp }: HostRsvpRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const h = eventHost(e, byId, memberById);
  const gov = kindOf(e).governance;
  const isMeeting = e.kind === "meeting";
  const exclusive = isExclusive(e);
  const past = isPastEvent(e);
  const isCircleMember = isEventCircleMember(e, profile, byId);
  const roleStatusClass = shiftCancelled(e) ? "text-soft" : (shiftNeedsSlots(e) ? "text-flame" : "text-leaf");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-faint py-4.5">
      <button
        // eventHost() always sets exactly one of circle/member, never both null
        onClick={() => (h.circle ? onOpenCircle(h.circle) : onOpenMember(h.member!))}
        className="flex cursor-pointer items-center gap-3 border-none bg-transparent p-0"
      >
        {h.member
          ? <Avatar member={h.member} size={40} />
          : <div className="flex h-10 w-10 items-center justify-center border border-ink bg-ink font-sans text-lg font-extrabold text-paper">{h.label[0]}</div>}
        <div className="text-left">
          {/* text-micro omitted: Eyebrow's inline-style guard already dropped this
              sub-11px override in the original code, and a className override
              wouldn't be silenced the same way — see event-masthead.jsx. */}
          <Eyebrow className="text-soft">{gov ? "Proposed by" : "Hosted by"}</Eyebrow>
          <div className="font-sans text-base font-bold">{h.label} →</div>
        </div>
      </button>
      {/* meetings have no separate RSVP — voting above is how you attend */}
      {!hasRoles(e) && !isMeeting && <RsvpButton going={going} count={attendeeCount} onToggle={onToggleRsvp} big disabled={past || (exclusive && !isCircleMember)} reason={past ? "past" : ((exclusive && !isCircleMember) ? "membersOnly" : undefined)} />}
      {hasRoles(e) && (
        <div className="text-right">
          <Eyebrow className={roleStatusClass}>{shiftCancelled(e) ? "Not running" : (shiftNeedsSlots(e) ? "Needs slots" : "Shift on")}</Eyebrow>
          <div className="font-sans text-base font-extrabold">{e.roles.reduce((n, r) => n + roleShort(r), 0)} signed up</div>
        </div>
      )}
    </div>
  );
}
