import clsx from "clsx";
import { Avatar, Eyebrow } from "@/components/shared";
import { useMemberById } from "@/lib/hooks";
import { hasRoles } from "@/lib/roles.util";
import type { Event, Member, Profile } from "@/lib/types";

interface AttendeesSectionProps {
  event: Event;
  profile: Profile;
  onOpenMember: (m: Member) => void;
}

/* Flat attendee roster for a non-slotted event (role-slotted events show
   who's in each role instead, via RoleSlotsSection). Everyone who can see an
   event can see who's going — the event is only ever visible to its own
   circle's members. */
export function AttendeesSection({ event: e, profile, onOpenMember }: AttendeesSectionProps) {
  // called before the early return below — hooks can't be conditional
  const memberById = useMemberById();
  if (hasRoles(e)) return null;
  const attendees = e.rsvps.map(memberById).filter((m): m is Member => Boolean(m));

  return (
    <section className="pt-8">
      <div className="flex items-baseline justify-between">
        <Eyebrow className="text-soft">Who’s going</Eyebrow>
        <span className="font-sans text-xs font-extrabold">{attendees.length}</span>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-0 border-t border-l border-ink">
        {attendees.map((m) => (
          <button
            key={m.id}
            className={clsx("ink-press flex cursor-pointer items-center gap-3 border-0 border-r border-b border-ink p-3.5 text-left", m.id === profile.id ? "bg-[#f4f4f4]" : "bg-paper")}
            onClick={() => onOpenMember(m)}
          >
            <Avatar member={m} size={44} />
            <div>
              <div className="font-sans text-sm font-bold">{m.name}{m.id === profile.id ? " (you)" : ""}</div>
              <Eyebrow className="text-soft">{m.role}</Eyebrow>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
