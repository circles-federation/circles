"use client";

import clsx from "clsx";
import { useCurrentFloatingAction } from "@/components/providers/floating-action-provider";
import { FloatingActionButton } from "./floating-action-button";

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
   bar, and an attached content box), this is navigation only.

   What the active tab offers to do is the page's floating action button (see
   useFloatingAction). Wider, it sits here, at the row's right end on the
   labels' line, beside the tabs it changes with, so that's plain to see; on a
   phone it floats above the bottom nav instead (AppShell). */
export function SimpleTabs({ tabs, active, onChange, className }: SimpleTabsProps) {
  const fab = useCurrentFloatingAction();
  return (
    <div className={clsx("relative flex gap-6 border-b border-faint", className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              // z-10: over the tab's content, which would otherwise cover the
              // bottom of its tap area (hit)
              "hit z-10 -mb-px cursor-pointer border-0 border-b-2 bg-transparent pb-3 font-sans text-base",
              on ? "border-b-ink font-bold text-ink" : "border-b-transparent font-normal text-soft hover:text-ink",
            )}
          >
            {t.label}
          </button>
        );
      })}
      {/* laid over the row rather than in it, centred on the labels' line (a
          base-size line is 1.5rem), so the row is the same height whichever
          tab is showing, button or not */}
      {fab.shown && (
        <div className="absolute top-0 right-0 hidden h-6 items-center min-[720px]:flex">
          <FloatingActionButton icon={fab.shown.icon} label={fab.shown.label} onClick={fab.run} size="small" />
        </div>
      )}
    </div>
  );
}
