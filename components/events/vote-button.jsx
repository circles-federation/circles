import { FAINT, FLAME, LEAF, PAPER, SOFT, sans } from "@/lib/theme";

/* Combined vote + attend control for a neighborhood assembly — voting for
   the meeting is how you indicate you'll be there, so there's only one
   action (see toggleVote in app-state-provider.jsx, which keeps votes and
   RSVPs in lockstep). Stays open even after quorum is met, since people
   can keep joining after confirmation — only closes once the event is
   past. Orange accent while proposed, green once confirmed. */
export function VoteButton({ voted, count, threshold, onToggle, big, eligible = true, ineligibleNote, past }) {
  const confirmed = count >= threshold;
  const accent = confirmed ? LEAF : FLAME;
  if (past) {
    return (
      <div
        title={confirmed ? "This meeting was held" : "This proposal did not reach quorum"}
        style={{
          fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 700, padding: big ? "14px 20px" : "9px 13px",
          border: `1px solid ${confirmed ? LEAF : FAINT}`, background: PAPER, color: confirmed ? LEAF : SOFT,
          display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", cursor: "default",
        }}
      >
        <span>{confirmed ? "✓ Held" : "Lapsed"}</span>
        <span style={{ fontWeight: 800, opacity: 0.85 }}>{count}/{threshold}</span>
      </div>
    );
  }
  if (!eligible) {
    return (
      <div
        title={ineligibleNote}
        style={{
          fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 700, padding: big ? "14px 20px" : "9px 13px",
          border: `1px solid ${FAINT}`, background: PAPER, color: SOFT,
          display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", cursor: "not-allowed",
        }}
      >
        <span>{count}/{threshold} votes</span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      title={confirmed ? "Quorum met — you can still join" : `${threshold - count} more vote${threshold - count === 1 ? "" : "s"} to confirm`}
      style={{
        fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.12em", textTransform: "uppercase",
        fontWeight: 700, cursor: "pointer", padding: big ? "14px 20px" : "9px 13px",
        border: `1px solid ${accent}`,
        background: voted ? accent : PAPER, color: voted ? PAPER : accent,
        display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
      }}
    >
      <span>{voted ? "✓ Going" : "RSVP"}</span>
      <span style={{ fontWeight: 800, opacity: 0.85 }}>{count}/{threshold}</span>
    </button>
  );
}
