import { FAINT, FLAME, LEAF, PAPER, SOFT, sans } from "@/lib/theme";

/* Vote control for governance events. Shows progress toward quorum; once met,
   the event is confirmed. Orange accent throughout. */
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
  if (confirmed) {
    return (
      <div
        title="Quorum met — this meeting is confirmed"
        style={{
          fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 700, padding: big ? "14px 20px" : "9px 13px",
          border: `1px solid ${LEAF}`, background: PAPER, color: LEAF,
          display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", cursor: "default",
        }}
      >
        <span>✓ Confirmed</span>
        <span style={{ fontWeight: 800, opacity: 0.85 }}>{count}/{threshold}</span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      title={`${threshold - count} more vote${threshold - count === 1 ? "" : "s"} to confirm`}
      style={{
        fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.12em", textTransform: "uppercase",
        fontWeight: 700, cursor: "pointer", padding: big ? "14px 20px" : "9px 13px",
        border: `1px solid ${accent}`,
        background: voted ? accent : PAPER, color: voted ? PAPER : accent,
        display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
      }}
    >
      <span>{voted ? "✓ Voted" : "Vote to hold"}</span>
      <span style={{ fontWeight: 800, opacity: 0.85 }}>{count}/{threshold}</span>
    </button>
  );
}
