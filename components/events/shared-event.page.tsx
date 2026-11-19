import { UserIcon, XCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { EventFacts } from "./event-facts";
import { EventHeader } from "./event-header";
import { GuestRsvp } from "./guest-rsvp";
import { Eyebrow, EyebrowGroup, MastheadGlow } from "@/components/shared";
import type { SharedEvent } from "@/lib/types";

interface SharedEventPageProps {
  event: SharedEvent;
  // this browser's confirmed RSVP, if it has one
  guest: { id: string; name: string } | null;
}

/* An event as someone without an account sees it, from a share link
   (/e/[token]). Outside the signed-in app, so there's no top bar, but it's the
   event page in the same layout: the colour wash behind the header, its kind
   and circle, the title and, from 960px, the date as a big tile; then When and
   Where as a boxed pair, the RSVP, who's hosting and who's going, in two
   columns on a wide screen and one run on a phone (`order` over `contents`
   columns). Everything here comes from SharedEvent, which carries no member
   ids: the people going are first names beside the same grey placeholder for
   everyone, and nothing in the list is a link. */
export function SharedEventPage({ event: e, guest }: SharedEventPageProps) {
  const host = e.hostCircleName ?? e.hostName;
  const label = e.cancelled ? "Cancelled" : e.ended ? "Past event" : "Event";

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-page px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-20 [--top-bar-height:0px]">
      <MastheadGlow tall />
      <div className="mx-auto w-full max-w-170 min-[960px]:max-w-270">
        <p className="font-sans text-sm font-extrabold tracking-heading">Circles</p>
        <p className="mt-6 font-serif text-lg text-body">{e.sharedBy} invited you to</p>

        <div className="mt-3">
          <EventHeader
            label={label}
            circleName={e.circleName}
            chipTitle={`${e.circleName}: who this event is for`}
            chipTone="plain"
            title={e.title}
            date={e.date}
            dateAccent={e.cancelled ? "soft" : "ink"}
          />
        </div>

        {(e.cancelled || e.ended) && (
          <div role="status" className="mt-6 flex items-center gap-3 border border-ink bg-paper px-4 py-3">
            <span className={clsx("flex size-9 shrink-0 items-center justify-center border border-ink", e.cancelled ? "bg-tint-danger text-on-action" : "bg-wash text-soft")}>
              {e.cancelled ? <XCircleIcon className="size-5" strokeWidth={2} aria-hidden /> : <CheckCircleIcon className="size-5" strokeWidth={2} aria-hidden />}
            </span>
            <p className="m-0 font-sans text-sm font-extrabold tracking-open">{e.cancelled ? "This event has been cancelled." : "This event has ended."}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-10 min-[960px]:grid min-[960px]:grid-cols-[1.15fr_1fr] min-[960px]:items-start min-[960px]:gap-x-12">
          <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
            {e.description && (
              <section className="order-2">
                <EyebrowGroup label="Details">
                  <p className="m-0 font-serif text-lg leading-normal whitespace-pre-line text-body">{e.description}</p>
                </EyebrowGroup>
              </section>
            )}
            <section className="order-3">
              <EyebrowGroup label="Hosted by">
                <div className="font-sans text-base font-bold">{host}</div>
                {e.hostCircleName && <div className="font-serif text-sm text-soft">organized by {e.hostName}</div>}
              </EyebrowGroup>
            </section>
          </div>

          <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
            <EventFacts event={e} closed={e.cancelled || e.ended} />
            {/* a role is taken by a member, so an event with roles has no guest RSVP */}
            {!e.cancelled && !e.ended && !e.hasRoles && (
              <div className="order-1">
                <GuestRsvp token={e.token} guest={guest} />
              </div>
            )}
            <section className="order-4">
              <div className="mb-4 flex items-center gap-3">
                <Eyebrow>{e.ended ? "Went" : "Going"}</Eyebrow>
                <span className="border border-ink bg-paper px-1.5 py-0.5 font-sans text-label leading-none font-bold tabular-nums">{e.going.length}</span>
              </div>
              {e.going.length > 0 && (
                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-0 border-t border-l border-ink p-0">
                  {e.going.map((name, i) => (
                    <li key={i} className="flex items-center gap-3 border-r border-b border-ink bg-paper p-4">
                      <div className="flex size-11 shrink-0 items-center justify-center border border-ink bg-faint">
                        <UserIcon className="size-5 text-soft" strokeWidth={1.5} aria-hidden />
                      </div>
                      <span className="font-sans text-base font-semibold">{name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
