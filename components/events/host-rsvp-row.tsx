import { RsvpButton } from "./rsvp-button";
import { Avatar, Eyebrow } from "@/components/shared";
import { audienceLabel } from "@/lib/circles.util";
import { isPastEvent } from "@/lib/format.util";
import { kindOf } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { hasRoles, roleShort, shiftCancelled, shiftNeedsSlots } from "@/lib/roles.util";
import type { Circle, Event, Member } from "@/lib/types";

interface HostRsvpRowProps {
  event: Event;
  going?: boolean;
  attendeeCount: number;
  onOpenCircle: (circle: Circle) => void;
  onOpenMember: (member: Member) => void;
  onToggleRsvp: () => void;
}

/* Who's hosting/proposing this event (always the person who created it) and
   which circle it's for (who can see it), plus the right-side action: an RSVP
   toggle for ordinary events, a signed-up count for role-slotted ones, or
   nothing for a meeting — meetings vote to attend instead (see
   MeetingVoteBanner), so they don't get a separate RSVP control here. */
export function HostRsvpRow({ event: e, going, attendeeCount, onOpenCircle, onOpenMember, onToggleRsvp }: HostRsvpRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const host = memberById(e.organizerId);
  const circle = byId[e.circleId];
  const gov = kindOf(e).governance;
  const isMeeting = e.kind === "meeting";
  const past = isPastEvent(e);
  const roleStatusClass = shiftCancelled(e) ? "text-soft" : (shiftNeedsSlots(e) ? "text-flame" : "text-leaf");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-faint py-4.5">
      <div className="flex items-center gap-3">
        {host && (
          <button onClick={() => onOpenMember(host)} aria-label={host.name} className="cursor-pointer border-none bg-transparent p-0">
            <Avatar member={host} size={40} />
          </button>
        )}
        <div className="text-left">
          {/* text-micro omitted: Eyebrow's inline-style guard already dropped this
              sub-11px override in the original code, and a className override
              wouldn't be silenced the same way — see event-masthead.jsx. */}
          <Eyebrow className="text-soft">{gov ? "Proposed by" : "Hosted by"}</Eyebrow>
          {host && (
            <button onClick={() => onOpenMember(host)} className="block cursor-pointer border-none bg-transparent p-0 text-left font-sans text-base font-bold">
              {host.name} →
            </button>
          )}
          {circle && (
            <button
              onClick={() => onOpenCircle(circle)}
              className="mt-0.5 block cursor-pointer border-none bg-transparent p-0 text-left font-serif text-sm text-soft underline underline-offset-2"
            >
              for {audienceLabel(circle)}
            </button>
          )}
        </div>
      </div>
      {/* meetings have no separate RSVP — voting above is how you attend */}
      {!hasRoles(e) && !isMeeting && <RsvpButton going={going} count={attendeeCount} onToggle={onToggleRsvp} big past={past} />}
      {hasRoles(e) && (
        <div className="text-right">
          <Eyebrow className={roleStatusClass}>{shiftCancelled(e) ? "Not running" : (shiftNeedsSlots(e) ? "Needs slots" : "Shift on")}</Eyebrow>
          <div className="font-sans text-base font-extrabold">{e.roles.reduce((n, r) => n + roleShort(r), 0)} signed up</div>
        </div>
      )}
    </div>
  );
}
