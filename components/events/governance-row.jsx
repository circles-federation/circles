"use client";

import clsx from "clsx";
import { EventRow } from "./event-row";
import { Eyebrow } from "@/components/shared";
import { hostInfo } from "@/lib/data";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { endorsementCount, isConfirmed, kindOf, meetingThreshold, neighborhoodMajority, voteCount } from "@/lib/governance.util";

// this row only ever shows governance kinds, and EVENT_KINDS' canonical
// labels ("Neighborhood Council Meeting", "Federation Council Meeting") read
// too long for the chip here — the full label stays intact everywhere else
// (e.g. event.page.jsx's masthead), this is purely a display choice for
// this cramped context.
const KIND_CHIP_LABEL = { meeting: "Meeting", council: "Council" };

/* A single governance-event row. Read-only — voting/endorsing happens on
   the event's own page; this just shows the vote/endorsement count. */
export function GovernanceRow({ e, onOpenEvent, hasCouncilProposal }) {
  const k = kindOf(e);
  const h = hostInfo(e.host);
  const isCouncil = e.kind === "council";
  const confirmed = isConfirmed(e);
  const past = isPastEvent(e);
  const accentKey = confirmed ? "leaf" : (past ? "soft" : "flame"); // fed to both DateTile and EventRow's own accent
  // status text differs: meetings count resident votes; councils count endorsing neighborhoods
  const votes = voteCount(e);
  const councilMaj = neighborhoodMajority();
  // councils are "voted" on via neighborhood endorsements rather than individual
  // votes, but the count/threshold display reads the same either way
  const count = isCouncil ? endorsementCount(e) : votes;
  const threshold = isCouncil ? councilMaj : meetingThreshold(e);
  const statusText = past
    ? (confirmed ? "· Held" : "· Lapsed")
    : isCouncil
      ? (confirmed ? "" : `· Proposed — ${councilMaj - endorsementCount(e)} more neighborhoods`)
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
      meta={`Proposed by ${h.label} · ${e.location}`}
      metaMuted={past}
      tags={
        <>
          <Eyebrow className="text-soft">{fmtTime(e.start)}–{fmtTime(e.end)}</Eyebrow>
          <Eyebrow className={accentKey === "leaf" ? "text-leaf" : accentKey === "flame" ? "text-flame" : "text-soft"}>
            · {KIND_CHIP_LABEL[e.kind] || k.label}
          </Eyebrow>
          {statusText && (
            <span className={clsx("font-sans text-label font-bold tracking-[0.08em] uppercase", confirmed ? "text-leaf" : "text-soft")}>
              {statusText}
            </span>
          )}
          {hasCouncilProposal && !past && (
            <span title="A federation council meeting has been proposed from this meeting" className="border border-flame px-1.75 py-px font-sans text-label font-bold tracking-[0.06em] text-flame uppercase">
              ◆ Meeting proposed
            </span>
          )}
        </>
      }
      right={
        <div className={clsx("font-sans text-sm font-extrabold whitespace-nowrap", confirmed ? "text-leaf" : (past ? "text-soft" : "text-ink"))}>
          {count}/{threshold} {past ? "Went" : "Going"}
        </div>
      }
    />
  );
}
