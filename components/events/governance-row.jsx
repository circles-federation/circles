"use client";

import clsx from "clsx";
import { DateTile } from "./date-tile";
import { VoteButton } from "./vote-button";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { CURRENT_USER_ID, hostInfo, memberById } from "@/lib/data";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { canVote, endorsementCount, isConfirmed, kindOf, neighborhoodMajority, scopeLabel, voteCount } from "@/lib/governance.util";
import { useIsMobile } from "@/lib/hooks";
import { FAINT, FLAME, INK, LEAF, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

// this row only ever shows governance kinds, and EVENT_KINDS' canonical
// labels ("Neighborhood Assembly", "Federation Council Meeting") read too
// long for the chip here — the full label stays intact everywhere else
// (e.g. event.page.jsx's masthead), this is purely a display choice for
// this cramped context.
const KIND_CHIP_LABEL = { assembly: "Assembly", council: "Council" };

export function GovernanceRow({ e, voteState, toggleVote, onOpenEvent, hasCouncilProposal }) {
  const isMobile = useIsMobile();
  const k = kindOf(e);
  const h = hostInfo(e.host);
  const isCouncil = e.kind === "council";
  const confirmed = isConfirmed(e);
  const voted = voteState[e.id];
  const past = isPastEvent(e);
  const accent = confirmed ? LEAF : (past ? SOFT : FLAME);
  const wash = past ? "transparent" : (confirmed ? "rgba(46,125,50,0.05)" : "rgba(225,83,11,0.035)");
  const metaColor = past ? SOFT : "#222";
  // status text differs: assemblies count resident votes; councils count endorsing neighborhoods
  const votes = voteCount(e);
  const councilMaj = neighborhoodMajority();
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
      {!isMobile && (
      <div style={{ flexShrink: 0, paddingTop: 4 }}>
        {isCouncil ? (
          <div
            title={confirmed ? "Confirmed by a majority of neighborhoods" : "Awaiting neighborhood endorsements"}
            style={{
              fontFamily: sans, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
              padding: "9px 13px", whiteSpace: "nowrap", cursor: "default",
              border: `1px solid ${confirmed ? LEAF : (past ? FAINT : FLAME)}`, background: PAPER, color: confirmed ? LEAF : (past ? SOFT : FLAME),
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            <span>{confirmed ? (past ? "✓ Held" : "✓ Confirmed") : (past ? "Lapsed" : "Endorsing")}</span>
            <span style={{ fontWeight: 800, opacity: 0.85 }}>{endorsementCount(e)}/{councilMaj}</span>
          </div>
        ) : (
          <VoteButton
            voted={voted}
            count={votes}
            threshold={k.threshold}
            onToggle={() => toggleVote(e.id)}
            eligible={canVote(e, memberById(CURRENT_USER_ID))}
            ineligibleNote={`Only people in ${scopeLabel(e)} can vote on this`}
            past={past}
          />
        )}
      </div>
      )}
    </div>
  );
}
