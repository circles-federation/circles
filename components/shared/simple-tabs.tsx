"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

interface SimpleTab {
  key: string;
  label: string;
}

interface SimpleTabsProps {
  tabs: SimpleTab[];
  active: string;
  onChange: (key: string) => void;
  // what the active tab offers to do (the bulletin's +), at the row's right
  // end, on the labels' line
  actions?: ReactNode;
  className?: string;
}

/* A plain, left-aligned tab row for switching between content blocks the
   caller renders itself — gray inactive labels, a bold black label plus a
   thin underline for the active one, all sitting on a single hairline.
   Unlike TabbedPanel (a boxed panel with equal-width tabs, a colored accent
   bar, and an attached content box), this is navigation only. */
export function SimpleTabs({ tabs, active, onChange, actions, className }: SimpleTabsProps) {
  return (
    <div className={clsx("flex gap-6 border-b border-faint", className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              "-mb-px cursor-pointer border-0 border-b-2 bg-transparent pb-3 font-sans text-base outline-none",
              on ? "border-b-ink font-bold text-ink" : "border-b-transparent font-normal text-soft hover:text-ink",
            )}
          >
            {t.label}
          </button>
        );
      })}
      {/* pb-3 like the labels, so an action is centred on their line; a 44px
          tap area inside it takes -my-2.5 so the row is no taller */}
      {actions && <div className="ml-auto flex items-center gap-1 pb-3">{actions}</div>}
    </div>
  );
}
