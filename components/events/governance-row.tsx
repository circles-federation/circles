"use client";

import clsx from "clsx";
import { CancelledBadge } from "./cancelled-badge";
import { EventRow } from "./event-row";
import { ParticipationBadge } from "./participation-badge";
import { Eyebrow } from "@/components/shared";
import { hasEnded, fmtTime } from "@/lib/format.util";
import { isApproved, isProposal, voteCount, voteThreshold } from "@/lib/governance.util";
import { useAppState } from "@/components/providers/app-state-provider";
import { isAttending } from "@/lib/events.util";
import { useClock, useCirclesById } from "@/lib/hooks";
import { REPEAT_SHORT_LABEL } from "@/lib/recurrence.util";
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
  const { profile } = useAppState();
  const proposal = isProposal(e);
  const circle = byId[e.circleId];
  const hostCircle = e.hostCircleId ? byId[e.hostCircleId] : undefined;
  const approved = isApproved(e, byId);
  const past = hasEnded(e, useClock());
  // fed to both DateTile and EventRow's own accent; a cancelled one is grey, like one that's over
  const accentKey = e.cancelled ? "soft" : approved ? "leaf" : (past ? "soft" : "flame");
  const votes = voteCount(e);
  const threshold = voteThreshold(e, byId);
  const statusText = e.cancelled
    ? ""
    : past
    ? (approved ? "" : "· Lapsed")
    : (approved ? "" : `· Proposed — ${threshold - votes} more to approve`);
  const hideOnMobile = !past && !approved;
  // the host: a proposal's host circle, or for a meeting the circle holding it
  // (see OrdinaryRow for why that's all the row says)
  const hostName = (hostCircle ?? circle)?.name ?? "";

  return (
    <EventRow
      e={e}
      onOpenEvent={onOpenEvent}
      dateAccent={accentKey}
      rowAccent={accentKey}
      title={e.title}
      titleMuted={past || !!e.cancelled}
      meta={hostName}
      metaMuted={past || !!e.cancelled}
      tags={
        <>
          <Eyebrow className="text-soft">{fmtTime(e.start)}–{fmtTime(e.end)}{e.repeat && ` · ${REPEAT_SHORT_LABEL[e.repeat.frequency]}`}</Eyebrow>
          {statusText && (
            <span className={clsx("font-sans text-label font-bold tracking-[0.08em] uppercase", hideOnMobile && "hidden min-[720px]:inline", approved ? "text-leaf" : past ? "text-soft" : "text-flame")}>
              {statusText}
            </span>
          )}
        </>
      }
      right={
        // cancelled: that, beside whether they were going
        e.cancelled ? <><CancelledBadge />{isAttending(e, profile.id) && <ParticipationBadge kind="attending" past />}</> :
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
