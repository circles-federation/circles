import { Eyebrow } from "@/components/shared/eyebrow";
import { INK, PAPER, SOFT, TYPE, sans } from "@/lib/theme";

/* A square statistic card: large Helvetica numeral over a label. */
export function StatCard({ value, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={onClick ? "ink-press" : undefined}
      style={{
        aspectRatio: "1 / 1", border: `1px solid ${INK}`, background: PAPER,
        cursor: onClick ? "pointer" : "default",
        display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "stretch",
        padding: 20, width: "100%",
      }}
    >
      <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro, textAlign: "left" }}>{label}</Eyebrow>
      <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.hero, letterSpacing: "-0.04em", lineHeight: 0.9, textAlign: "right" }}>
        {value}
      </div>
    </button>
  );
}
