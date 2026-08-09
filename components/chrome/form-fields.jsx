import { INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* Shared field styles for every editable form (event creation, governance
   proposals, editable tags, and the profile/org "manage" pages) so labels and
   inputs look identical no matter which form they're in. */
export const fieldLabel = { fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: SOFT, display: "block", marginBottom: 8 };
export const fieldInput = { width: "100%", padding: "11px 12px", border: `1px solid ${INK}`, fontFamily: serif, fontSize: TYPE.base, background: PAPER, outline: "none", boxSizing: "border-box" };
