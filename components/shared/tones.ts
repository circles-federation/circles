/* The pale status fills, black text on each (see the tint tokens in
   app/globals.css): done, in progress, overdue, and the action colour. Badge
   (an ink outline, caps) and StatusPill (sentence case, no outline but action's)
   both draw from this one map, so a retuned colour is changed once. */
export const PALE_FILL = {
  leaf: "bg-tint-leaf text-on-action",
  warn: "bg-tint-warn text-on-action",
  danger: "bg-tint-danger text-on-action",
  action: "bg-action text-on-action",
} as const;

export type PaleTone = keyof typeof PALE_FILL;
