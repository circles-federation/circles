import { UserIcon } from "@heroicons/react/24/outline";
import { GuestRsvp } from "./guest-rsvp";
import { Eyebrow } from "@/components/shared";
import { MONTHS, WEEKDAYS, fmtTime, parseDay } from "@/lib/format.util";
import type { SharedEvent } from "@/lib/types";

interface SharedEventPageProps {
  event: SharedEvent;
  // this browser's confirmed RSVP, if it has one
  guest: { id: string; name: string } | null;
}

/* An event as someone without an account sees it, from a share link
   (/e/[token]). Outside the signed-in app, so it's laid out like the welcome
   page rather than under a top bar. Everything here comes from SharedEvent,
   which carries no member ids: the people going are first names beside the
   same grey placeholder for everyone, and nothing in the list is a link. */
export function SharedEventPage({ event: e, guest }: SharedEventPageProps) {
  const day = parseDay(e.date);
  const dateLabel = isNaN(day.getTime()) ? "Date TBD" : `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}`;
  const host = e.hostCircleName ?? e.hostName;

  return (
    <div className="min-h-dvh bg-paper px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-20">
      <div className="mx-auto w-full max-w-170">
        <p className="font-sans text-sm font-extrabold tracking-[-0.02em]">Circles</p>
        <p className="mt-6 font-serif text-lg text-soft">{e.sharedBy} invited you to</p>

        <div className="mt-3 border-t-[3px] border-b border-t-ink border-b-ink pt-5 pb-6">
          <div className="font-sans text-lg leading-snug font-bold text-ink">{dateLabel}</div>
          <div className="mt-0.5 font-sans text-base leading-snug font-semibold text-soft">
            {fmtTime(e.start)}–{fmtTime(e.end)}
          </div>
          <h1 className="mt-4 font-sans text-heading leading-[0.95] font-extrabold tracking-[-0.035em] min-[720px]:text-title">{e.title}</h1>
          <p className="mt-3 font-serif text-lg text-body">{e.location}</p>
        </div>

        {e.cancelled && (
          <p className="border-b border-faint py-4 font-sans text-sm font-bold text-danger">This event has been cancelled.</p>
        )}
        {!e.cancelled && e.ended && <p className="border-b border-faint py-4 font-sans text-sm font-bold text-soft">This event has ended.</p>}

        {/* a role is taken by a member, so an event with roles has no guest RSVP */}
        {!e.cancelled && !e.ended && !e.hasRoles && (
          <div className="border-b border-faint py-5">
            <GuestRsvp token={e.token} guest={guest} />
          </div>
        )}

        <div className="border-b border-faint py-5">
          <Eyebrow className="text-soft">Hosted by</Eyebrow>
          <div className="font-sans text-base font-bold">{host}</div>
          {e.hostCircleName && <div className="font-serif text-sm text-soft">organized by {e.hostName}</div>}
        </div>

        {e.description && (
          <div className="border-b border-faint py-5">
            <p className="font-serif text-lg leading-normal whitespace-pre-line text-body">{e.description}</p>
          </div>
        )}

        <div className="py-5">
          <Eyebrow className="text-soft">{e.ended ? "Went" : "Going"} · {e.going.length}</Eyebrow>
          {e.going.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
              {e.going.map((name, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center border border-ink bg-faint">
                    <UserIcon className="size-5 text-soft" strokeWidth={1.5} aria-hidden />
                  </div>
                  <span className="font-sans text-base font-semibold">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
