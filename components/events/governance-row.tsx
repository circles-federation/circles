"use client";

import clsx from "clsx";
import { EventRow } from "./event-row";
import { Eyebrow } from "@/components/shared";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { isConfirmed, kindOf, meetingThreshold, voteCount } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface GovernanceRowProps {
  e: Event;
  onOpenEvent: (e: Event) => void;
}

/* A single governance-event row. Read-only — voting/endorsing happens on
   the event's own page; this just shows the vote count. */
export function GovernanceRow({ e, onOpenEvent }: GovernanceRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const k = kindOf(e);
  const host = memberById(e.organizerId);
  const confirmed = isConfirmed(e, byId);
  const past = isPastEvent(e);
  const accentKey = confirmed ? "leaf" : (past ? "soft" : "flame"); // fed to both DateTile and EventRow's own accent
  const votes = voteCount(e);
  const threshold = meetingThreshold(e, byId);
  const statusText = past
    ? (confirmed ? "· Held" : "· Lapsed")
    : (confirmed ? "" : `· Proposed — ${threshold - votes} more to confirm`);

  return (
    <EventRow
      e={e}
      onOpenEvent={onOpenEvent}
      dateAccent={accentKey}
      rowAccent={accentKey}
      washed={!past}
      title={e.title}
      titleMuted={past && !confirmed}
      meta={`Proposed by ${host?.name ?? ""} · ${byId[e.circleId]?.name ?? ""} · ${e.location}`}
      metaMuted={past}
      tags={
        <>
          <Eyebrow className="text-soft">{fmtTime(e.start)}–{fmtTime(e.end)}</Eyebrow>
          <Eyebrow className={accentKey === "leaf" ? "text-leaf" : accentKey === "flame" ? "text-flame" : "text-soft"}>
            · {k.label}
          </Eyebrow>
          {statusText && (
            <span className={clsx("font-sans text-label font-bold tracking-[0.08em] uppercase", confirmed ? "text-leaf" : "text-soft")}>
              {statusText}
            </span>
          )}
        </>
      }
      right={
        <div className={clsx("font-sans text-sm font-extrabold whitespace-nowrap", confirmed ? "text-leaf" : (past ? "text-soft" : "text-ink"))}>
          {votes}/{threshold} {past ? "Went" : "Going"}
        </div>
      }
    />
  );
}
