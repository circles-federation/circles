import { FAINT, INK, PAPER, PLUM, SOFT, sans } from "@/lib/theme";

export function RsvpButton({ going, count, onToggle, big, disabled, reason }) {
  if (disabled) {
    const label = reason === "membersOnly"
      ? "Members only"
      : (going ? "✓ Went" : "Ended");
    const title = reason === "membersOnly"
      ? "Only members of the hosting organization can RSVP to this event"
      : "This event has already happened";
    return (
      <div
        title={title}
        style={{
          fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.14em", textTransform: "uppercase",
          fontWeight: 700, padding: big ? "14px 22px" : "9px 14px",
          border: `1px solid ${reason === "membersOnly" ? PLUM : FAINT}`, background: PAPER, color: reason === "membersOnly" ? PLUM : SOFT,
          display: "inline-flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", cursor: "not-allowed",
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 800, opacity: 0.7 }}>{count}</span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      style={{
        fontFamily: sans, fontSize: big ? 12 : 11, letterSpacing: "0.14em", textTransform: "uppercase",
        fontWeight: 700, cursor: "pointer", padding: big ? "14px 22px" : "9px 14px",
        border: `1px solid ${INK}`,
        background: going ? INK : PAPER, color: going ? PAPER : INK,
        display: "inline-flex", alignItems: "center", gap: 10,
      }}
    >
      <span>{going ? "✓ Going" : "RSVP"}</span>
      <span style={{ fontWeight: 800, opacity: 0.7 }}>{count}</span>
    </button>
  );
}
