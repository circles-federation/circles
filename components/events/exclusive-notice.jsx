import { Eyebrow } from "@/components/chrome/eyebrow";
import { hostInfo } from "@/lib/data";
import { isExclusive, isHostOrgMember } from "@/lib/governance.util";

/* Explains why RSVP is member-only for an org-hosted "members only" event.
   Visible to everyone (the event itself isn't hidden), but tells a non-member
   viewer specifically why they can't RSVP. Renders nothing for non-exclusive
   events. */
export function ExclusiveNotice({ event: e, profile }) {
  if (!isExclusive(e)) return null;
  const h = hostInfo(e.host);
  const isHostMember = isHostOrgMember(e, profile);

  return (
    <div className="mt-5 border border-plum border-l-4 bg-plum/5 px-4.5 py-4">
      <Eyebrow className="text-plum">Members-only event</Eyebrow>
      <p className="mt-2 max-w-[44em] font-serif text-sm leading-relaxed text-[#222]">
        Anyone can see this event, but only members of {h.label} can RSVP, and only members are emailed about it.
        {isHostMember
          ? " You're a member, so you can RSVP and you'll be notified."
          : " You're not a member, so RSVP is closed and you won't be emailed about it."}
      </p>
    </div>
  );
}
