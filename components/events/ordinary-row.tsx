"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { EventRow } from "./event-row";
import { ParticipationBadge } from "./participation-badge";
import { Eyebrow } from "@/components/shared";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { useAppState } from "@/components/providers/app-state-provider";
import { isAttending } from "@/lib/events.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { hasRoles, shiftCancelled } from "@/lib/roles.util";
import type { Event } from "@/lib/types";

interface OrdinaryRowProps {
  e: Event;
  onOpenEvent: (e: Event) => void;
}

/* A single ordinary-event row. Read-only — RSVPing/signing up happens on
   the event's own page; this just shows whether the signed-in member is
   attending. */
export function OrdinaryRow({ e, onOpenEvent }: OrdinaryRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const { profile } = useAppState();
  const host = memberById(e.organizerId);
  const circle = byId[e.circleId];
  const hostCircle = e.hostCircleId ? byId[e.hostCircleId] : undefined;
  const past = isPastEvent(e);
  const attending = isAttending(e, profile.id);
  const cancelled = !past && hasRoles(e) && shiftCancelled(e);

  return (
    <EventRow
      e={e}
      onOpenEvent={onOpenEvent}
      dateAccent={past ? "soft" : undefined}
      title={e.title}
      titleMuted={past}
      meta={[`Hosted by ${hostCircle?.name ?? host?.name ?? ""}`, hostCircle?.id !== circle?.id ? circle?.name : undefined, e.location].filter(Boolean).join(" · ")}
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
          {attending && <ParticipationBadge kind="attending" past={past} />}
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
