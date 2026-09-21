"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { EventRow } from "./event-row";
import { Eyebrow } from "@/components/shared";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { hasRoles, roleShort, shiftCancelled } from "@/lib/roles.util";
import type { Event } from "@/lib/types";

interface OrdinaryRowProps {
  e: Event;
  onOpenEvent: (e: Event) => void;
}

/* A single ordinary-event row. Read-only — RSVPing/signing up happens on
   the event's own page; this just shows how many people are going. */
export function OrdinaryRow({ e, onOpenEvent }: OrdinaryRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const host = memberById(e.organizerId);
  const past = isPastEvent(e);
  // slotted events don't use a plain RSVP list — count signups across roles instead
  const count = hasRoles(e) ? e.roles.reduce((sum, r) => sum + roleShort(r), 0) : e.rsvps.length;
  const cancelled = !past && hasRoles(e) && shiftCancelled(e);

  return (
    <EventRow
      e={e}
      onOpenEvent={onOpenEvent}
      dateAccent={past ? "soft" : undefined}
      title={e.title}
      titleMuted={past}
      meta={`Hosted by ${host?.name ?? ""} · ${byId[e.circleId]?.name ?? ""} · ${e.location}`}
      metaMuted={past}
      tags={
        <>
          <Eyebrow className="text-soft">
            {fmtTime(e.start)}–{fmtTime(e.end)}
          </Eyebrow>
        </>
      }
      right={
        <>
          <div className={clsx("font-sans text-sm font-extrabold whitespace-nowrap", past ? "text-soft" : "text-ink")}>
            {count} {past ? "Went" : "Going"}
          </div>
          {cancelled && (
            <div className="mt-0.5 inline-flex items-center gap-1 font-sans text-micro font-bold tracking-[0.06em] text-flame uppercase whitespace-nowrap">
              <ExclamationTriangleIcon className="size-3" strokeWidth={2.5} />
              Cancelled
            </div>
          )}
        </>
      }
    />
  );
}
