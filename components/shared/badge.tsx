import clsx from "clsx";
import type { ReactNode } from "react";
import { PALE_FILL } from "./tones";

/* A small outlined label in caps: a member's role in a circle. Outlined in
   ink by default (the circle's Members grid), where inside a card that
   inverts while pressed it keeps its own paper and ink (ink-press-badge), so
   it still reads. The pale ones (leaf, warn, danger, action) are for status. Subtle is a quieter grey, for beside a name that should
   lead (a message's Handled by). */
const VARIANTS = {
  default: "ink-press-badge border-ink bg-paper text-ink",
  subtle: "border-faint text-soft",
  // pale status fills, black text, an ink outline (Facilitator, Overdue)
  leaf: `border-ink ${PALE_FILL.leaf}`,
  warn: `border-ink ${PALE_FILL.warn}`,
  danger: `border-ink ${PALE_FILL.danger}`,
  action: `border-ink ${PALE_FILL.action}`,
};

export function Badge({ children, title, variant = "default" }: { children: ReactNode; title?: string; variant?: keyof typeof VARIANTS }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex max-w-full items-center gap-1 overflow-hidden whitespace-nowrap border px-2 py-1 font-sans text-label font-bold uppercase tracking-caps",
        VARIANTS[variant],
      )}
    >
      {children}
    </span>
  );
}
