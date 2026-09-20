"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Eyebrow } from "./eyebrow";

// a group is single-select by default (an "All" option plus one active value,
// same shape as Events' Status filter) — pass multi: true for a group whose
// options aren't mutually exclusive (e.g. the Circles page's entity-type
// filter, where "Councils" and "Organizations" can both be on at once).
interface FilterGroupDataSingle {
  label: string;
  options: string[];
  multi?: false;
  active: string | null;
  onFilter: (value: string | null) => void;
}

interface FilterGroupDataMulti {
  label: string;
  options: string[];
  multi: true;
  active: string[];
  // called with the full next selection, not just the toggled value, so the
  // caller can hand this straight to a plain useState setter
  onFilter: (value: string[]) => void;
}

type FilterGroupData = FilterGroupDataSingle | FilterGroupDataMulti;

/* The magnifying-glass icon, text input, and (when there's a query) the
   clear button — the left/middle portion of the bordered search row.
   Private to SearchWithFilter, which supplies the shared border around it
   and FilterTrigger together. */
function SearchField({ query, onQuery, placeholder }: { query: string; onQuery: (value: string) => void; placeholder?: string }) {
  return (
    <>
      <span className="flex items-center pl-3.5">
        <MagnifyingGlassIcon className="size-4" strokeWidth={2} />
      </span>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-none bg-paper py-3 pr-3.5 pl-2 font-serif text-base outline-none"
      />
      {query && (
        <button
          onClick={() => onQuery("")}
          aria-label="Clear search"
          title="Clear search"
          className="flex cursor-pointer items-center justify-center border-none bg-paper px-3 text-soft"
        >
          <XMarkIcon className="size-4" strokeWidth={2} />
        </button>
      )}
    </>
  );
}

/* The funnel button that opens the filter menu, with a small flame badge
   showing how many filter groups are active. */
function FilterTrigger({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Filter"
      title="Filter"
      className={clsx(
        "relative flex cursor-pointer items-center justify-center border-0 border-l border-ink px-3.5 text-base",
        activeCount > 0 ? "bg-ink text-paper" : "bg-paper text-ink",
      )}
    >
      <FunnelIcon className="size-3.5" strokeWidth={2.5} />
      {activeCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-3.75 min-w-3.75 items-center justify-center rounded-full bg-flame px-0.75 font-sans text-[10px] leading-none font-extrabold text-paper">
          {activeCount}
        </span>
      )}
    </button>
  );
}

/* One filter option row inside a FilterGroup — "All" or one of the group's
   own option values (single-select), or one independently-toggleable option
   (multi-select). Visually identical either way — only how `onSelect` is
   wired differs. */
function FilterOption({ label, selected, isLast, onSelect }: { label: string; selected: boolean; isLast: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "cursor-pointer flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left font-sans text-xs font-semibold tracking-[0.04em]",
        !isLast && "border-b border-faint",
        selected ? "bg-ink text-paper" : "bg-paper text-ink",
      )}
    >
      {label}
      {selected && <CheckIcon className="size-3" strokeWidth={3} />}
    </button>
  );
}

/* One labeled group of options in the filter menu — a header (label +
   "Clear" when active) over the options themselves: a single-select group
   gets an "All" option prepended (picking one clears the rest), a multi
   group's options are independently toggleable checkboxes with no "All"
   row (deselecting everything is already equivalent to "All"). */
function FilterGroup({ group: g, isLast }: { group: FilterGroupData; isLast: boolean }) {
  const isActive = g.multi ? g.active.length > 0 : g.active !== null;

  return (
    <div className={clsx(!isLast && "border-b-2 border-ink")}>
      <div className="flex items-center justify-between border-b border-faint bg-[#f4f4f4] px-3.5 pt-2.25 pb-2">
        <Eyebrow className="text-soft">{g.label}</Eyebrow>
        {isActive && (
          <button
            onClick={() => (g.multi ? g.onFilter([]) : g.onFilter(null))}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-micro font-bold tracking-[0.06em] text-flame uppercase"
          >
            Clear
          </button>
        )}
      </div>
      {g.multi
        ? g.options.map((opt, i) => (
          <FilterOption
            key={opt}
            label={opt}
            selected={g.active.includes(opt)}
            isLast={i === g.options.length - 1}
            onSelect={() => g.onFilter(g.active.includes(opt) ? g.active.filter((a) => a !== opt) : [...g.active, opt])}
          />
        ))
        : [null, ...g.options].map((opt, i, all) => (
          <FilterOption
            key={opt || "all"}
            label={opt || "All"}
            selected={g.active === opt}
            isLast={i === all.length - 1}
            onSelect={() => g.onFilter(opt)}
          />
        ))}
    </div>
  );
}

/* The dropdown itself — one FilterGroup per entry in `groups`, floated
   below the search row. */
function FilterMenu({ groups }: { groups: FilterGroupData[] }) {
  return (
    <div className="absolute top-[calc(100%+4px)] right-0 z-40 max-h-100 min-w-55 max-w-full overflow-y-auto border border-ink bg-paper shadow-[4px_4px_0_rgba(10,10,10,0.08)]">
      {groups.map((g, gi) => (
        <FilterGroup key={g.label || gi} group={g} isLast={gi === groups.length - 1} />
      ))}
    </div>
  );
}

interface SearchWithFilterProps {
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
  // preferred API — one or more filter groups
  filters?: FilterGroupData[];
  // legacy single-filter API, normalized into one group below
  filterLabel?: string;
  options?: string[];
  active?: string | null;
  onFilter?: (value: string | null) => void;
  // spacing above this component is the caller's job, not a built-in
  // default — how much (if any) depends on what, if anything, sits above it
  // on a given page (see city-directory.page.jsx and events-list.page.jsx,
  // where that varies by breakpoint since their PageHeader hides on mobile).
  className?: string;
}

/* Search input with a compact filter menu attached to its right edge. Supports
   one or more filter groups via the `filters` prop:
     filters = [{ label, options, active, onFilter }, ...]
   Each group renders as a labeled section in a single dropdown, single-select
   by default or independently-toggleable options with `multi: true`. The
   trigger is a small funnel icon that shows a count badge when any group has
   a selection. A legacy single-filter API (filterLabel/options/active/onFilter)
   is still accepted and normalized into one single-select group. */
export function SearchWithFilter({ query, onQuery, placeholder, filters, filterLabel, options, active, onFilter, className }: SearchWithFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // normalize: accept either `filters` (new) or the legacy single-filter props
  const groups: FilterGroupData[] = filters || (options && onFilter ? [{ label: filterLabel || "", options, active: active ?? null, onFilter }] : []);
  const activeCount = groups.filter((g) => (g.multi ? g.active.length > 0 : g.active !== null)).length;

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className={clsx("relative", className)}>
      <div className="flex items-stretch border border-ink">
        <SearchField query={query} onQuery={onQuery} placeholder={placeholder} />
        {groups.length > 0 && <FilterTrigger activeCount={activeCount} onClick={() => setOpen((o) => !o)} />}
      </div>
      {open && <FilterMenu groups={groups} />}
    </div>
  );
}
