"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { AgendaBadge } from "./agenda-section";
import { Button, Input, TextArea } from "@/components/shared";
import { AGENDA_CATEGORIES, AGENDA_CATEGORY, MAX_AGENDA_ITEMS } from "@/lib/agenda.util";
import type { AgendaCategory } from "@/lib/types";

// an item as it's being typed — details is "" rather than absent
export interface AgendaDraft {
  category: AgendaCategory;
  title: string;
  details: string;
}

export const BLANK_AGENDA_ITEM: AgendaDraft = { category: "explore", title: "", details: "" };

/* The event form's agenda for a meeting: an ordered list of items, each
   marked Report, Explore or Decide (see lib/agenda.util.ts), with a line on
   what the chosen one means so the choice is easy to make. Items can be
   reordered, since the agenda is run top to bottom. */
export function AgendaEditor({ items, onChange }: { items: AgendaDraft[]; onChange: (items: AgendaDraft[]) => void }) {
  const set = (i: number, patch: Partial<AgendaDraft>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    if (item) next.splice(i + by, 0, item);
    onChange(next);
  };
  const control = "inline-flex size-7 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-soft hover:text-ink disabled:cursor-default disabled:opacity-30";

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="border border-t-[3px] border-faint border-t-agenda px-4 pt-3 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-sans text-eyebrow font-bold tracking-caps text-soft uppercase">Topic {i + 1}</span>
            <div className="-mr-1.5 flex items-center">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up" aria-label={`Move topic ${i + 1} up`} className={control}>
                <ArrowUpIcon className="size-4" strokeWidth={2} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down" aria-label={`Move topic ${i + 1} down`} className={control}>
                <ArrowDownIcon className="size-4" strokeWidth={2} />
              </button>
              {items.length > 1 && (
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} title="Remove" aria-label={`Remove topic ${i + 1}`} className={control}>
                  <XMarkIcon className="size-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          <div role="radiogroup" aria-label={`Topic ${i + 1}: what the circle will do with it`} className="grid grid-cols-3 gap-2">
            {AGENDA_CATEGORIES.map((c) => {
              const chosen = item.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => set(i, { category: c })}
                  title={AGENDA_CATEGORY[c].label}
                  className={clsx(
                    "ink-press flex cursor-pointer items-center justify-center gap-2 border bg-paper px-2 py-1.5 font-sans text-sm font-bold min-[480px]:justify-start",
                    chosen ? "border-agenda text-agenda" : "border-faint text-soft",
                  )}
                >
                  <AgendaBadge category={c} outline={!chosen} />
                  {/* just the letter on a phone, where three labels don't fit
                      side by side; the hint below names the chosen one */}
                  <span className="sr-only min-[480px]:not-sr-only">{AGENDA_CATEGORY[c].label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
            {/* named here on a phone, where the buttons show only letters */}
            <strong className="font-bold text-agenda min-[480px]:hidden">{AGENDA_CATEGORY[item.category].label}: </strong>
            {AGENDA_CATEGORY[item.category].hint}
          </p>

          <div className="mt-3 flex flex-col gap-3">
            <Input value={item.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Topic (e.g. Repair budget)" aria-label={`Topic ${i + 1} title`} />
            <TextArea value={item.details} onChange={(e) => set(i, { details: e.target.value })} rows={2} placeholder="Details (optional)" aria-label={`Topic ${i + 1} details`} />
          </div>
        </div>
      ))}
      {items.length < MAX_AGENDA_ITEMS && (
        <Button variant="secondary" size="compact" onClick={() => onChange([...items, { ...BLANK_AGENDA_ITEM }])} className="self-start">
          <PlusIcon className="size-3.5" strokeWidth={2.5} />
          Add topic
        </Button>
      )}
    </div>
  );
}
