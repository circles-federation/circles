"use client";

import clsx from "clsx";

interface SimpleTab {
  key: string;
  label: string;
}

interface SimpleTabsProps {
  tabs: SimpleTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/* A plain, left-aligned tab row for switching between content blocks the
   caller renders itself — gray inactive labels, a bold black label plus a
   thin underline for the active one, all sitting on a single hairline.
   Unlike TabbedPanel (a boxed panel with equal-width tabs, a colored accent
   bar, and an attached content box), this is navigation only. */
export function SimpleTabs({ tabs, active, onChange, className }: SimpleTabsProps) {
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
    </div>
  );
}
