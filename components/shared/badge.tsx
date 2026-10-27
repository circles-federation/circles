import clsx from "clsx";
import type { ReactNode } from "react";

/* A small outlined label in caps: a member's role in a circle. Outlined in
   ink by default (the circle's Members grid), where inside a card that
   inverts while pressed it keeps its own paper and ink (ink-press-badge), so
   it still reads. Subtle is a quieter grey, for beside a name that should
   lead (a message's Handled by). */
export function Badge({ children, title, variant = "default" }: { children: ReactNode; title?: string; variant?: "default" | "subtle" }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap border px-2 py-1 font-sans text-label font-bold uppercase tracking-caps",
        variant === "subtle" ? "border-faint text-soft" : "ink-press-badge border-ink bg-paper text-ink",
      )}
    >
      {children}
    </span>
  );
}
