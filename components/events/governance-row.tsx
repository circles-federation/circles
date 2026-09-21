"use client";

import clsx from "clsx";
import { EventRow } from "./event-row";
import { Eyebrow } from "@/components/shared";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { isConfirmed, isProposal, voteCount, voteThreshold } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface GovernanceRowProps {
  e: Event;
  onOpenEvent: (e: Event) => void;
}

/* A single row for an event that's being voted on — a meeting, or a circle-
   hosted proposal. Read-only — voting happens on the event's own page; this
   just shows the vote count. */
export function GovernanceRow({ e, onOpenEvent }: GovernanceRowProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const host = memberById(e.organizerId);
  const proposal = isProposal(e);
  const circle = byId[e.circleId];
  const hostCircle = e.hostCircleId ? byId[e.hostCircleId] : undefined;
  const confirmed = isConfirmed(e, byId);
  const past = isPastEvent(e);
  const accentKey = confirmed ? "leaf" : (past ? "soft" : "flame"); // fed to both DateTile and EventRow's own accent
  const votes = voteCount(e);
  const threshold = voteThreshold(e, byId);
  const statusText = past
    ? (confirmed ? "· Held" : "· Lapsed")
    : (confirmed ? "" : `· Proposed — ${threshold - votes} more to ${proposal ? "approve" : "confirm"}`);
  // a proposal names the circle proposing it and the one it would be shown to
  const where = hostCircle && circle && hostCircle.id !== circle.id ? `${hostCircle.name} for ${circle.name}` : (hostCircle ?? circle)?.name ?? "";

  return (
    <EventRow
      e={e}
      onOpenEvent={onOpenEvent}
      dateAccent={accentKey}
      rowAccent={accentKey}
      washed={!past}
      title={e.title}
      titleMuted={past && !confirmed}
      meta={`Proposed by ${host?.name ?? ""} · ${where} · ${e.location}`}
      metaMuted={past}
      tags={
        <>
          <Eyebrow className="text-soft">{fmtTime(e.start)}–{fmtTime(e.end)}</Eyebrow>
          {statusText && (
            <span className={clsx("font-sans text-label font-bold tracking-[0.08em] uppercase", confirmed ? "text-leaf" : past ? "text-soft" : "text-flame")}>
              {statusText}
            </span>
          )}
        </>
      }
      right={
        <div className={clsx("font-sans text-sm font-extrabold whitespace-nowrap", confirmed ? "text-leaf" : (past ? "text-soft" : "text-ink"))}>
          {votes}/{threshold} {proposal ? "Votes" : past ? "Went" : "Going"}
        </div>
      }
    />
  );
}
