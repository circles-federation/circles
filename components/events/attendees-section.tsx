import clsx from "clsx";
import { UserIcon } from "@heroicons/react/24/outline";
import { Avatar, Eyebrow } from "@/components/shared";
import { useEventEnded, useMemberById } from "@/lib/hooks";
import { hasRoles } from "@/lib/roles.util";
import { GuestAvatar } from "./guest-avatar";
import type { Event, Member, MeetingGuest, Profile } from "@/lib/types";

interface AttendeesSectionProps {
  event: Event;
  profile: Profile;
  onOpenMember: (m: Member) => void;
  // a meeting's guests, from its session: written in without an account
  meetingGuests?: MeetingGuest[];
}

/* Flat attendee roster for a non-slotted event (role-slotted events show
   who's in each role instead, via RoleSlotsSection). Everyone who can see an
   event can see who's going — the event is only ever visible to its own
   circle's members. */
export function AttendeesSection({ event: e, profile, onOpenMember, meetingGuests = [] }: AttendeesSectionProps) {
  // called before the early return below — hooks can't be conditional
  const memberById = useMemberById();
  const ended = useEventEnded(e);
  if (hasRoles(e)) return null;
  const attendees = e.rsvps.map(memberById).filter((m): m is Member => Boolean(m));
  // guests who RSVPed from a share link: a first name, nothing to open
  const guests = e.guests ?? [];

  return (
    <section className="pt-8">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-3">
          <Eyebrow>{ended ? "Who went" : "Who’s going"}</Eyebrow>
          <span className="border border-ink bg-paper px-1.5 py-0.5 font-sans text-label leading-none font-bold tabular-nums">{attendees.length + guests.length + meetingGuests.length}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-0 border-t border-l border-ink">
        {attendees.map((m) => (
          <button
            key={m.id}
            className={clsx("ink-press flex cursor-pointer items-center gap-3 border-0 border-r border-b border-ink p-4 text-left", m.id === profile.id ? "bg-wash" : "bg-paper")}
            onClick={() => onOpenMember(m)}
          >
            <Avatar member={m} size={44} />
            <div>
              <div className="font-sans text-sm font-bold">{m.name}{m.id === profile.id ? " (you)" : ""}</div>
              <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{m.role}</span>
            </div>
          </button>
        ))}
        {meetingGuests.map((g) => (
          <div key={g.id} className="flex items-center gap-3 border-0 border-r border-b border-ink bg-paper p-4">
            <GuestAvatar eventId={e.id} guest={g} />
            <div>
              <div className="font-sans text-sm font-bold">{g.name}</div>
              <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">Guest</span>
            </div>
          </div>
        ))}
        {guests.map((name, i) => (
          <div key={i} className="flex items-center gap-3 border-0 border-r border-b border-ink bg-paper p-4">
            <div className="flex size-11 shrink-0 items-center justify-center border border-ink bg-faint">
              <UserIcon className="size-5 text-soft" strokeWidth={1.5} aria-hidden />
            </div>
            <div>
              <div className="font-sans text-sm font-bold">{name}</div>
              <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">Guest</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
