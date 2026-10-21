"use client";

import { useEffect, useRef } from "react";
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
   phone it floats above the bottom nav instead (AppShell).

   On a phone too narrow for every tab (a member of a circle has five), the
   row scrolls sideways, its scrollbar hidden, and the active tab is brought
   into view; the hairline is drawn inside the scrolling row so the active
   tab's underline still sits on it. */
export function SimpleTabs({ tabs, active, onChange, className }: SimpleTabsProps) {
  const fab = useCurrentFloatingAction();
  const rowRef = useRef<HTMLDivElement>(null);

  // the active tab in view, sideways only (scrollIntoView could move the page)
  useEffect(() => {
    const row = rowRef.current;
    const tab = row?.querySelector<HTMLElement>("[aria-current]");
    if (!row || !tab) return;
    const left = tab.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (left + tab.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left + tab.offsetWidth - row.clientWidth;
  }, [active]);

  return (
    // flow-root, so the row's -mt-3 stays inside this box rather than
    // collapsing through it, which would lift the + (placed from its top) off
    // the labels' line
    <div className={clsx("relative flow-root", className)}>
      {/* room above the labels inside the scrolling row (pt-3, taken back by
          -mt-3), so their tap areas (hit) aren't clipped by it; and no
          scrolling up and down, which the few pixels of tap area below the
          labels would otherwise allow */}
      <div
        ref={rowRef}
        className="-mt-3 flex gap-5 overflow-x-auto overflow-y-hidden pt-3 shadow-[inset_0_-1px_0_var(--color-faint)] [scrollbar-width:none] min-[720px]:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              aria-current={on ? "page" : undefined}
              className={clsx(
                // z-10: over the tab's content, which would otherwise cover the
                // bottom of its tap area (hit)
                "hit z-10 shrink-0 cursor-pointer border-0 border-b-2 bg-transparent pb-3 font-sans text-base whitespace-nowrap",
                on ? "border-b-ink font-bold text-ink" : "border-b-transparent font-normal text-soft hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
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
