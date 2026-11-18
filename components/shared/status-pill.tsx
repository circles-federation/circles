import clsx from "clsx";
import type { ReactNode } from "react";
import { PALE_FILL } from "./tones";

const TONES = {
  outline: "border-ink bg-paper text-ink",
  // a pale fill needs no outline of its own; the action colour keeps its ink one
  leaf: `border-transparent ${PALE_FILL.leaf}`,
  warn: `border-transparent ${PALE_FILL.warn}`,
  danger: `border-transparent ${PALE_FILL.danger}`,
  action: `border-ink ${PALE_FILL.action}`,
};

/* A small status in sentence case, a pale fill with black text (Going,
   Organizing, a due date): information, so not in caps like a Badge. */
export function StatusPill({ tone = "outline", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={clsx("inline-block shrink-0 border px-2 py-0.5 font-sans text-xs font-bold whitespace-nowrap", TONES[tone])}>{children}</span>;
}
