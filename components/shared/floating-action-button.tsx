"use client";

import clsx from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface FloatingActionButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon: ReactNode;
  bottom?: number | string;
}

/* Square (per this app's zero-border-radius rule), fixed-position action
   button in the bottom-right corner — first used for the welcome page's
   "Demo accounts" trigger. The caller supplies the icon and decides
   visibility (e.g. mobile-only via a `min-[720px]:hidden` className),
   since not every use wants the same breakpoint behavior.

   `bottom` is a plain inline style, not a Tailwind class, on purpose: a
   page under app/(app)/ has BottomNav fixed along the same edge, so its
   FAB needs a taller offset than the welcome page's default 24px — and
   without tailwind-merge in this app, a caller-supplied `bottom-*` class
   can't reliably beat one already baked into this component's className.
   Either way it's measured from above the home indicator, not the screen's
   edge. */
export function FloatingActionButton({ icon, title, bottom = 24, className, style, ...rest }: FloatingActionButtonProps) {
  const offset = typeof bottom === "number" ? `${bottom}px` : bottom;
  return (
    <button
      title={title}
      aria-label={title}
      className={clsx(
        "ink-press fixed right-6 z-40 flex h-13 w-13 cursor-pointer items-center justify-center border border-ink bg-paper shadow-[4px_4px_0_rgba(10,10,10,1)]",
        className,
      )}
      style={{ bottom: `calc(${offset} + env(safe-area-inset-bottom))`, ...style }}
      {...rest}
    >
      {icon}
    </button>
  );
}
