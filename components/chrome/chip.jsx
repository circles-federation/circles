"use client";

import { useAppState } from "@/components/providers/app-state-provider";
import { INK, PAPER, TEAL, TYPE, sans } from "@/lib/theme";

/* A small place badge. Solid ink = elsewhere/federation-level (the noteworthy
   case); hollow = local to this neighborhood (the quiet default).            */
const FEDERATION_LABEL = "Providence"; // the city federation's name (org level)
export function Chip({ children, title }) {
  // color is derived from the place: the CURRENT USER's own neighborhood is
  // teal, the city federation is black, any other neighborhood is a white
  // outline. Compared against the signed-in member's own neighborhood, not a
  // fixed constant — this is a shared login, and whoever's signed in should
  // see their own home highlighted, not always "The 903".
  const { profile } = useAppState();
  const place = typeof children === "string" ? children : "";
  let bg = PAPER, fg = INK, bd = INK;
  if (place === profile.neighborhood) { bg = TEAL; fg = PAPER; bd = TEAL; }
  else if (place === FEDERATION_LABEL) { bg = INK; fg = PAPER; bd = INK; }
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: sans, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
        padding: "4px 9px", marginRight: 6, whiteSpace: "nowrap",
        border: `1px solid ${bd}`,
        background: bg, color: fg,
      }}
    >
      <span style={{ fontSize: TYPE.micro, opacity: 0.85 }}>◆</span>
      {children}
    </span>
  );
}
