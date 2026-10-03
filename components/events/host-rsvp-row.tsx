import { RsvpButton } from "./rsvp-button";
import { Avatar, Eyebrow } from "@/components/shared";
import { isPastEvent } from "@/lib/format.util";
import { isProposal, isScheduledMeeting, isVoting } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { hasRoles, roleShort, shiftAtRisk, shiftNeedsSlots } from "@/lib/roles.util";
import type { Circle, Event, Member } from "@/lib/types";

interface HostRsvpRowProps {
  event: Event;
  going?: boolean;
  attendeeCount: number;
  onOpenCircle: (circle: Circle) => void;
  onOpenMember: (member: Member) => void;
  onToggleRsvp: () => void;
}

/* Who's hosting/proposing this event and which circle it's for (who can see
   it), plus the right-side action: an RSVP toggle for ordinary events, a
   signed-up count for role-slotted ones, or nothing for a meeting (those vote
   to attend instead, unless one of the circle's Leader, Secretary or
   Facilitator scheduled it — then it's an RSVP too) or a proposal still awaiting its host circle's approval
   — see VoteBanner, which owns the vote control. When a circle hosts, it's
   named as the host and the person who created it as its proposer. */
export function HostRsvpRow({ event: e, going, attendeeCount, onOpenCircle, onOpenMember, onToggleRsvp }: HostRsvpRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const host = memberById(e.organizerId);
  const hostCircle = e.hostCircleId ? byId[e.hostCircleId] : undefined;
  const voting = isVoting(e);
  const proposal = isProposal(e);
  // attended by voting: a meeting, unless it was scheduled without a vote
  const votesToAttend = e.kind === "meeting" && !isScheduledMeeting(e);
  const past = isPastEvent(e);
  const roleStatus = e.cancelled ? "Not running" : shiftAtRisk(e) ? "At risk" : shiftNeedsSlots(e) ? "Needs slots" : "Shift on";
  // a short slot is a heads-up, so yellow — as a highlight under ink, since
  // yellow text wouldn't read on white
  const roleStatusClass = e.cancelled ? "text-soft" : shiftAtRisk(e) || shiftNeedsSlots(e) ? "bg-warning px-1.5 py-0.5 text-ink" : "text-leaf";

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
          <Eyebrow className="text-soft">
            {isScheduledMeeting(e) ? `Scheduled by the ${e.approvedByRole}` : voting || hostCircle ? (hostCircle ? "Hosted by" : "Proposed by") : "Hosted by"}
          </Eyebrow>
          {hostCircle ? (
            <button onClick={() => onOpenCircle(hostCircle)} className="block cursor-pointer border-none bg-transparent p-0 text-left font-sans text-base font-bold">
              {hostCircle.name} →
            </button>
          ) : host && (
            <button onClick={() => onOpenMember(host)} className="block cursor-pointer border-none bg-transparent p-0 text-left font-sans text-base font-bold">
              {host.name} →
            </button>
          )}
          {hostCircle && host && (
            <button
              onClick={() => onOpenMember(host)}
              className="mt-0.5 block cursor-pointer border-none bg-transparent p-0 text-left font-serif text-sm text-soft underline underline-offset-2"
            >
              {e.approvedByRole ? `approved by the ${e.approvedByRole}, ${host.name}` : `${proposal ? "proposed" : "organized"} by ${host.name}`}
            </button>
          )}
        </div>
      </div>
      {/* meetings have no separate RSVP — voting above is how you attend — and
          a proposal opens for RSVPs only once approved */}
      {/* a cancelled event takes no RSVPs; its attendees are still listed below */}
      {!hasRoles(e) && !votesToAttend && !proposal && !e.cancelled && <RsvpButton going={going} count={attendeeCount} onToggle={onToggleRsvp} big past={past} />}
      {hasRoles(e) && !proposal && (
        <div className="text-right">
          <Eyebrow className={roleStatusClass}>{roleStatus}</Eyebrow>
          <div className="font-sans text-base font-extrabold">{e.roles.reduce((n, r) => n + roleShort(r), 0)} signed up</div>
        </div>
      )}
    </div>
  );
}
