"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Eyebrow } from "./eyebrow";

/* The magnifying-glass icon, text input, and (when there's a query) the
   clear button — the left/middle portion of the bordered search row.
   Private to SearchWithFilter, which supplies the shared border around it
   and FilterTrigger together. */
function SearchField({ query, onQuery, placeholder }) {
  return (
    <>
      <span className="flex items-center pl-3.5 text-soft">
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
function FilterTrigger({ activeCount, onClick }) {
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
   own option values. */
function FilterOption({ label, selected, isLast, onSelect }) {
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
   "Clear" when active) over the "All" option plus each of the group's own. */
function FilterGroup({ group: g, isLast }) {
  const all = [null, ...g.options];
  return (
    <div className={clsx(!isLast && "border-b-2 border-ink")}>
      <div className="flex items-center justify-between border-b border-faint bg-[#f4f4f4] px-3.5 pt-2.25 pb-2">
        <Eyebrow className="text-soft">{g.label}</Eyebrow>
        {g.active && (
          <button
            onClick={() => g.onFilter(null)}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-micro font-bold tracking-[0.06em] text-flame uppercase"
          >
            Clear
          </button>
        )}
      </div>
      {all.map((opt, i) => (
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
function FilterMenu({ groups }) {
  return (
    <div className="absolute top-[calc(100%+4px)] right-0 z-40 max-h-100 min-w-55 max-w-full overflow-y-auto border border-ink bg-paper shadow-[4px_4px_0_rgba(10,10,10,0.08)]">
      {groups.map((g, gi) => (
        <FilterGroup key={g.label || gi} group={g} isLast={gi === groups.length - 1} />
      ))}
    </div>
  );
}

/* Search input with a compact filter menu attached to its right edge. Supports
   one or more filter groups via the `filters` prop:
     filters = [{ label, options, active, onFilter }, ...]
   Each group renders as a labeled section in a single dropdown. The trigger is
   a small funnel icon that shows a dot when any filter is active. A legacy
   single-filter API (filterLabel/options/active/onFilter) is still accepted and
   normalized into one group. */
export function SearchWithFilter({ query, onQuery, placeholder, filters, filterLabel, options, active, onFilter }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // normalize: accept either `filters` (new) or the legacy single-filter props
  const groups = filters || (options ? [{ label: filterLabel, options, active, onFilter }] : []);
  const activeCount = groups.filter((g) => g.active).length;

  useEffect(() => {
    if (!open) return;
    function onDoc(ev) { if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative mt-5">
      <div className="flex items-stretch border border-ink">
        <SearchField query={query} onQuery={onQuery} placeholder={placeholder} />
        {groups.length > 0 && <FilterTrigger activeCount={activeCount} onClick={() => setOpen((o) => !o)} />}
      </div>
      {open && <FilterMenu groups={groups} />}
    </div>
  );
}
