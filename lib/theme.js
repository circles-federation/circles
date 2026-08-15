/* ============================================================
   Design system carried from The Commons Institute:
   ink-on-white, Helvetica Neue display / Georgia body,
   hairline rules, wide-tracked eyebrows, zero border-radius,
   the circled-question motif.
   ============================================================ */

export const INK = "#0a0a0a";
export const PAPER = "#ffffff";
export const SOFT = "#6b6b6b";
export const FAINT = "#e4e4e4";
export const FLAME = "#e1530b"; // accent for governance events still being proposed
export const LEAF = "#2e7d32"; // accent for confirmed governance events
export const TEAL = "#0f7d77"; // the home neighborhood's chip color
export const PLUM = "#6a3d9a"; // members-only (exclusive) events
export const DANGER = "#c0392b"; // destructive actions, error states

export const sans = '"Helvetica Neue", Arial, sans-serif';
export const serif = 'Georgia, "Times New Roman", serif';

/* ---- Type scale (major third, 1.25) ------------------------------
   A deliberate editorial hierarchy. Three display tiers (fluid, tight
   tracking, Helvetica) sit above an eight-step text ramp. Everything
   in the app maps onto these steps so the hierarchy reads as intended
   rather than drifting across near-duplicate sizes. */
export const TYPE = {
  hero: "clamp(40px, 11vw, 64px)",   // top-level mastheads (Home, Federation)
  title: "clamp(30px, 8vw, 44px)",   // page titles, event/form mastheads
  heading: "clamp(24px, 6vw, 32px)", // sub-mastheads, card-page headers
  xl: 20,     // large statements, organization names
  lg: 18,     // section leads, prominent body
  base: 16,   // standard body (Georgia)
  sm: 14,     // secondary text, meta
  xs: 13,     // dense meta, captions, buttons
  eyebrow: 12,// tracked uppercase labels (Eyebrow enforces an 11px floor)
  label: 11,  // small uppercase status labels, pills, chips (the eyebrow floor)
  micro: 9,   // the smallest tracked labels (dates, tags)
};
// display headings share tight negative tracking; eyebrows share wide tracking
export const TRACK_TIGHT = "-0.03em";
export const TRACK_WIDE = "0.1em";
