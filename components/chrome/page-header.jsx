import { INK, TYPE, sans } from "@/lib/theme";

/* Consistent page header: a large Helvetica title on the left, optional
   actions on the right, a hairline rule beneath. The row is a FIXED height with
   everything vertically centered, so the rule always sits the same distance
   below the title — whether the right slot holds small text, a tall button, or
   nothing. Items never wrap (a right-side button stays on the title's line). */
export function PageHeader({ title, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: `1px solid ${INK}`, paddingBottom: 16, height: 48, flexWrap: "nowrap" }}>
      <h2 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.heading, letterSpacing: "-0.03em", lineHeight: 1.15, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h2>
      {children && <div style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>{children}</div>}
    </div>
  );
}
