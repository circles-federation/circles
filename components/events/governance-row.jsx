"use client";

import clsx from "clsx";
import { DateTile } from "./date-tile";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { hostInfo } from "@/lib/data";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { endorsementCount, isConfirmed, kindOf, neighborhoodMajority, voteCount } from "@/lib/governance.util";
import { FLAME, INK, LEAF, SOFT, TYPE, sans, serif } from "@/lib/theme";

// this row only ever shows governance kinds, and EVENT_KINDS' canonical
// labels ("Neighborhood Assembly", "Federation Council Meeting") read too
// long for the chip here — the full label stays intact everywhere else
// (e.g. event.page.jsx's masthead), this is purely a display choice for
// this cramped context.
const KIND_CHIP_LABEL = { assembly: "Assembly", council: "Council" };

/* A single governance-event row. Read-only — voting/endorsing happens on
   the event's own page; this just shows the vote/endorsement count. */
export function GovernanceRow({ e, onOpenEvent, hasCouncilProposal }) {
  const k = kindOf(e);
  const h = hostInfo(e.host);
  const isCouncil = e.kind === "council";
  const confirmed = isConfirmed(e);
  const past = isPastEvent(e);
  const accent = confirmed ? LEAF : (past ? SOFT : FLAME);
  const wash = past ? "transparent" : (confirmed ? "rgba(46,125,50,0.05)" : "rgba(225,83,11,0.035)");
  const metaColor = past ? SOFT : "#222";
  // status text differs: assemblies count resident votes; councils count endorsing neighborhoods
  const votes = voteCount(e);
  const councilMaj = neighborhoodMajority();
  // councils are "voted" on via neighborhood endorsements rather than individual
  // votes, but the count/threshold display reads the same either way
  const count = isCouncil ? endorsementCount(e) : votes;
  const threshold = isCouncil ? councilMaj : k.threshold;
  const statusText = past
    ? (confirmed ? "· Held" : "· Lapsed")
    : isCouncil
      ? (confirmed ? "" : `· Proposed — ${councilMaj - endorsementCount(e)} more neighborhoods`)
      : (confirmed ? "" : `· Proposed — ${k.threshold - votes} more to confirm`);
  return (
    <div style={{ borderBottom: `1px solid ${INK}`, display: "flex", gap: 18, padding: "20px 22px 20px 16px", alignItems: "flex-start", borderLeft: `4px solid ${accent}`, background: wash }}>
      <DateTile iso={e.date} accentColor={accent} />
      <button
        onClick={() => onOpenEvent(e)}
        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{fmtTime(e.start)}–{fmtTime(e.end)}</Eyebrow>
          <Eyebrow style={{ color: accent, fontSize: TYPE.micro }}>· {KIND_CHIP_LABEL[e.kind] || k.label}</Eyebrow>
          {statusText && (
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", color: confirmed ? LEAF : SOFT }}>
              {statusText}
            </span>
          )}
          {hasCouncilProposal && !past && (
            <span title="A federation council meeting has been proposed from this assembly" style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.label, letterSpacing: "0.06em", textTransform: "uppercase", color: FLAME, border: `1px solid ${FLAME}`, padding: "1px 7px" }}>
              ◆ Meeting proposed
            </span>
          )}
        </div>
        <div className={clsx("mt-1.75 mb-1.5 font-sans text-lg min-[720px]:text-xl font-extrabold tracking-[-0.025em] leading-[1.05]", past && !confirmed ? "text-soft" : "text-ink")}>
          {e.title}
        </div>
        <div style={{ fontFamily: serif, fontSize: TYPE.sm, color: metaColor }}>
          Proposed by {h.label} · {e.location}
        </div>
      </button>
      <div style={{ flexShrink: 0, paddingTop: 4, textAlign: "right" }}>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.sm, color: confirmed ? LEAF : (past ? SOFT : INK), whiteSpace: "nowrap" }}>
          {count}/{threshold} {past ? "Went" : "Going"}
        </div>
      </div>
    </div>
  );
}
