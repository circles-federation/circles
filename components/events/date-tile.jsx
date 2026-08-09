import { MONTHS, WEEKDAYS, parseDay } from "@/lib/format.util";
import { INK, PAPER, SOFT, sans } from "@/lib/theme";

/* A small calendar tile used in the list and the detail header. */
export function DateTile({ iso, large, accentColor }) {
  const d = parseDay(iso);
  const w = large ? 84 : 58;
  const barColor = accentColor || INK;
  const valid = iso && !isNaN(d.getTime());
  if (!valid) {
    return (
      <div style={{ width: w, flexShrink: 0, border: `1px solid ${barColor}`, textAlign: "center", background: PAPER }}>
        <div style={{ background: barColor, color: PAPER, fontFamily: sans, fontWeight: 700, fontSize: large ? 11 : 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: large ? "5px 0" : "4px 0" }}>
          TBD
        </div>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: large ? 30 : 22, letterSpacing: "-0.03em", lineHeight: 1.1, padding: large ? "10px 0" : "7px 0", color: SOFT }}>
          —
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: w, flexShrink: 0, border: `1px solid ${barColor}`, textAlign: "center", background: PAPER }}>
      <div style={{ background: barColor, color: PAPER, fontFamily: sans, fontWeight: 700, fontSize: large ? 11 : 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: large ? "5px 0" : "4px 0" }}>
        {MONTHS[d.getMonth()]}
      </div>
      <div style={{ fontFamily: sans, fontWeight: 800, fontSize: large ? 38 : 26, letterSpacing: "-0.03em", lineHeight: 1.1, padding: large ? "6px 0 2px" : "3px 0 0" }}>
        {d.getDate()}
      </div>
      <div style={{ fontFamily: sans, fontWeight: 600, fontSize: large ? 10 : 8, letterSpacing: "0.16em", textTransform: "uppercase", color: SOFT, paddingBottom: large ? 6 : 4 }}>
        {WEEKDAYS[d.getDay()]}
      </div>
    </div>
  );
}
