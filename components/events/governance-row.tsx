"use client";

import clsx from "clsx";
import { EventRow } from "./event-row";
import { ParticipationBadge } from "./participation-badge";
import { Eyebrow } from "@/components/shared";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { isApproved, isProposal, voteCount, voteThreshold } from "@/lib/governance.util";
import { useAppState } from "@/components/providers/app-state-provider";
import { isAttending } from "@/lib/events.util";
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
  const { profile } = useAppState();
  const host = memberById(e.organizerId);
  const proposal = isProposal(e);
  const circle = byId[e.circleId];
  const hostCircle = e.hostCircleId ? byId[e.hostCircleId] : undefined;
  const approved = isApproved(e, byId);
  const past = isPastEvent(e);
  const accentKey = approved ? "leaf" : (past ? "soft" : "flame"); // fed to both DateTile and EventRow's own accent
  const votes = voteCount(e);
  const threshold = voteThreshold(e, byId);
  const statusText = past
    ? (approved ? "· Held" : "· Lapsed")
    : (approved ? "" : `· Proposed — ${threshold - votes} more to approve`);
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
      titleMuted={past && !approved}
      meta={`Proposed by ${host?.name ?? ""} · ${where} · ${e.location}`}
      metaMuted={past}
      tags={
        <>
          <Eyebrow className="text-soft">{fmtTime(e.start)}–{fmtTime(e.end)}</Eyebrow>
          {statusText && (
            <span className={clsx("font-sans text-label font-bold tracking-[0.08em] uppercase", approved ? "text-leaf" : past ? "text-soft" : "text-flame")}>
              {statusText}
            </span>
          )}
        </>
      }
      right={
        // where the viewer stands: once it's approved, whether they're attending;
        // until then, whether they've voted to approve it (for a meeting that vote
        // is also their RSVP, but it's the approval that's still in question)
        approved
          ? isAttending(e, profile.id) && <ParticipationBadge kind="attending" past={past} className="text-leaf" />
          : (e.votes ?? []).includes(profile.id) && <ParticipationBadge kind="approved" past={past} />
      }
    />
  );
}
