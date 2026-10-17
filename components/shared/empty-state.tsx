import Link from "next/link";
import type { ReactNode } from "react";

/* What a list says when there's nothing in it: one shape everywhere — a
   sentence saying what will appear here and how, and, where there's
   something to do about it, the action that fills it (a compact outlined
   button to its page). Not for a small inline status ("None yet." under a
   tag field, a proposal's "No answer yet"). */
export function EmptyState({ children, action }: { children: ReactNode; action?: { label: string; href: string } }) {
  return (
    <div>
      <p className="max-w-[42em] font-serif text-base leading-normal text-soft">{children}</p>
      {action && (
        <Link
          href={action.href}
          className="ink-press hit mt-3 inline-flex items-center border border-ink bg-paper px-4 py-3 font-sans text-xs font-bold tracking-caps text-ink uppercase no-underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
