"use client";

import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Button, Input, Label } from "@/components/shared";

// a slot as it's being typed — min and max are the field text
export interface SlotDraft {
  label: string;
  description: string;
  min: string;
  max: string;
}

export const BLANK_SLOT: SlotDraft = { label: "", description: "", min: "1", max: "" };

/* The event form's slots, on a view of their own: a flat list, one slot per
   row between hairlines (not a box inside a box), so a phone has room to type.
   A new slot takes focus so the keyboard is already up for its name. */
export function SlotsEditor({ slots, onChange }: { slots: SlotDraft[]; onChange: (slots: SlotDraft[]) => void }) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const set = (i: number, patch: Partial<SlotDraft>) => onChange(slots.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div>
      <ul className="border-t border-ink">
        {slots.map((s, i) => (
          <li key={i} className="flex flex-col gap-3 border-b border-faint py-4">
            <div className="flex items-center gap-2">
              <Input
                value={s.label}
                onChange={(e) => set(i, { label: e.target.value })}
                placeholder="Role name (e.g. Shift lead)"
                aria-label={`Role ${i + 1} name`}
                autoFocus={focusIndex === i}
              />
              <button
                type="button"
                onClick={() => onChange(slots.filter((_, j) => j !== i))}
                aria-label={`Remove role ${i + 1}`}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-soft hover:text-ink"
              >
                <XMarkIcon className="size-4" strokeWidth={2.5} />
              </button>
            </div>
            <Input value={s.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Description (optional)" aria-label={`Role ${i + 1} description`} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`slot-min-${i}`} className="mb-1">At least</Label>
                <Input id={`slot-min-${i}`} type="number" inputMode="numeric" min="0" value={s.min} onChange={(e) => set(i, { min: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`slot-max-${i}`} className="mb-1">Up to</Label>
                <Input id={`slot-max-${i}`} type="number" inputMode="numeric" min="1" value={s.max} onChange={(e) => set(i, { max: e.target.value })} placeholder="No limit" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        size="compact"
        onClick={() => {
          setFocusIndex(slots.length);
          onChange([...slots, { ...BLANK_SLOT }]);
        }}
        className="mt-4"
      >
        <PlusIcon className="size-4" strokeWidth={2.5} />
        Add role
      </Button>
    </div>
  );
}
