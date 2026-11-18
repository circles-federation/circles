import clsx from "clsx";
import type { ReactNode } from "react";

const TONES = {
  outline: "border-ink bg-paper text-ink",
  leaf: "border-tint-leaf bg-tint-leaf text-on-action",
  warn: "border-tint-warn bg-tint-warn text-on-action",
  danger: "border-tint-danger bg-tint-danger text-on-action",
  action: "border-ink bg-action text-on-action",
};

/* A small status in sentence case, a pale fill with black text (Going,
   Organizing, a due date): information, so not in caps like a Badge. */
export function StatusPill({ tone = "outline", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={clsx("inline-block shrink-0 border px-2 py-0.5 font-sans text-xs font-bold whitespace-nowrap", TONES[tone])}>{children}</span>;
}
