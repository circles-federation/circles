import { RsvpButton } from "./rsvp-button";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { hostInfo } from "@/lib/data";
import { isPastEvent } from "@/lib/format.util";
import { isExclusive, isHostOrgMember, kindOf } from "@/lib/governance.util";
import { hasRoles, roleShort, shiftCancelled, shiftNeedsSlots } from "@/lib/roles.util";

/* Who's hosting/proposing this event, plus the right-side action: an RSVP
   toggle for ordinary/council events, a signed-up count for role-slotted
   ones, or nothing for an assembly — assemblies vote to attend instead (see
   AssemblyVoteBanner), so they don't get a separate RSVP control here. */
export function HostRsvpRow({ event: e, profile, going, attendeeCount, onOpenOrg, onOpenMember, onToggleRsvp }) {
  const h = hostInfo(e.host);
  const gov = kindOf(e).governance;
  const isAssembly = e.kind === "assembly";
  const exclusive = isExclusive(e);
  const past = isPastEvent(e);
  const isHostMember = isHostOrgMember(e, profile);
  const roleStatusClass = shiftCancelled(e) ? "text-soft" : (shiftNeedsSlots(e) ? "text-flame" : "text-leaf");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-faint py-4.5">
      <button
        onClick={() => (h.org ? onOpenOrg(h.org) : onOpenMember(h.member))}
        className="flex cursor-pointer items-center gap-3 border-none bg-transparent p-0"
      >
        {h.avatar
          ? <img src={h.avatar} alt="" className="h-10 w-10 border border-ink object-cover" />
          : <div className="flex h-10 w-10 items-center justify-center border border-ink bg-ink font-sans text-lg font-extrabold text-paper">{h.label[0]}</div>}
        <div className="text-left">
          {/* text-micro omitted: Eyebrow's inline-style guard already dropped this
              sub-11px override in the original code, and a className override
              wouldn't be silenced the same way — see event-masthead.jsx. */}
          <Eyebrow className="text-soft">{gov ? "Proposed by" : "Hosted by"}</Eyebrow>
          <div className="font-sans text-base font-bold">{h.label} →</div>
        </div>
      </button>
      {/* assemblies have no separate RSVP — voting above is how you attend */}
      {!hasRoles(e) && !isAssembly && <RsvpButton going={going} count={attendeeCount} onToggle={onToggleRsvp} big disabled={past || (exclusive && !isHostMember)} reason={past ? "past" : ((exclusive && !isHostMember) ? "membersOnly" : undefined)} />}
      {hasRoles(e) && (
        <div className="text-right">
          <Eyebrow className={roleStatusClass}>{shiftCancelled(e) ? "Not running" : (shiftNeedsSlots(e) ? "Needs slots" : "Shift on")}</Eyebrow>
          <div className="font-sans text-base font-extrabold">{e.roles.reduce((n, r) => n + roleShort(r), 0)} signed up</div>
        </div>
      )}
    </div>
  );
}
