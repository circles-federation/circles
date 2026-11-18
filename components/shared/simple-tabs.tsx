"use client";

import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import clsx from "clsx";

interface SimpleTab {
  key: string;
  label: string;
  // shown before the label on a tablet or wider (600px on), where there's room
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  // how many new things are in it (an Inbox's unread messages), a grey number
  // after the label; none at 0
  count?: number;
}

interface SimpleTabsProps {
  tabs: SimpleTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/* A plain, left-aligned tab row for switching between content blocks the
   caller renders itself — ink inactive labels, the active one a bold label
   on a filled ink block, all sitting on a single hairline (the top bar's lower edge). Navigation only.

   On a phone too narrow for every tab (a member of a circle has five), the
   row scrolls sideways, its scrollbar hidden, and the active tab is brought
   into view. */
export function SimpleTabs({ tabs, active, onChange, className }: SimpleTabsProps) {
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
    // collapsing through it into what's above
    <div className={clsx("flow-root", className)}>
      {/* room above the labels inside the scrolling row (pt-3, taken back by
          -mt-3), so their tap areas (hit) aren't clipped by it; and no
          scrolling up and down, which the few pixels of tap area below the
          labels would otherwise allow */}
      <div
        ref={rowRef}
        className="-mt-3 flex gap-2 overflow-x-auto overflow-y-hidden pt-3 pb-3 [scrollbar-width:none] min-[720px]:gap-3 [&::-webkit-scrollbar]:hidden"
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
                "hit z-10 flex shrink-0 cursor-pointer items-center gap-2 border-0 px-3 py-1.5 font-sans text-base whitespace-nowrap",
                on ? "bg-ink font-bold text-paper" : "bg-transparent font-semibold text-ink",
              )}
            >
              {t.icon && <t.icon className="hidden size-4 shrink-0 min-[600px]:block" strokeWidth={on ? 2.5 : 2} aria-hidden />}
              {t.label}
              {/* a bare grey number after the label, as the app counts things
                  ("Open · 3"): read as part of it, not something calling out */}
              {!!t.count && (
                <span className={clsx("font-normal tabular-nums", on ? "text-paper" : "text-soft")}>
                  {t.count > 99 ? "99+" : t.count}
                  <span className="sr-only"> new</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
