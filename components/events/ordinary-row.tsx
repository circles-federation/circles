"use client";

import { CancelledBadge } from "./cancelled-badge";
import { EventRow } from "./event-row";
import { ParticipationBadge } from "./participation-badge";
import { Eyebrow } from "@/components/shared";
import { hasEnded, fmtTime } from "@/lib/format.util";
import { useAppState } from "@/components/providers/app-state-provider";
import { isAttending } from "@/lib/events.util";
import { useClock, useCirclesById, useMemberById } from "@/lib/hooks";
import { REPEAT_SHORT_LABEL } from "@/lib/recurrence.util";
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
  const hostCircle = e.hostCircleId ? byId[e.hostCircleId] : undefined;
  const past = hasEnded(e, useClock());
  const attending = isAttending(e, profile.id);

  return (
    <EventRow
      e={e}
      onOpenEvent={onOpenEvent}
      dateAccent={past ? "soft" : undefined}
      title={e.title}
      titleMuted={past || !!e.cancelled}
      // just the host, so the row stays short on a phone — the event's own
      // page has its circle and location
      meta={hostCircle?.name ?? host?.name ?? ""}
      metaMuted={past || !!e.cancelled}
      tags={
        <>
          <Eyebrow className="text-soft">
            {fmtTime(e.start)}–{fmtTime(e.end)}{e.repeat && ` · ${REPEAT_SHORT_LABEL[e.repeat.frequency]}`}
          </Eyebrow>
        </>
      }
      right={
        <>
          {e.cancelled && <CancelledBadge />}
          {attending && <ParticipationBadge kind="attending" past={past} />}
        </>
      }
    />
  );
}
