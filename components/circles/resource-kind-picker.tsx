"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { FIELD } from "@/components/shared/input";
import type { ResourceIcon } from "@/lib/types";
import { RESOURCE_ICONS, RESOURCE_ICON_TEXT, RESOURCE_OPTIONS, resourceOption } from "./resource-kinds";

interface ResourceKindPickerProps {
  id?: string;
  value: ResourceIcon;
  onChange: (kind: ResourceIcon) => void;
  // who an announcement is for, in its hint ("members", "neighbors")
  audience: string;
}

/* What a bulletin item is, chosen from a list that shows each kind as the
   board will: its icon in its color, its name, and a line on what it's for.
   A native select can't show an icon or a color, so it's a field-styled
   button opening a listbox under it, like the skill and interest
   suggestions: arrow keys move through it, Enter or Space picks, Escape or a
   tap elsewhere closes it, and focus stays on the button throughout. */
export function ResourceKindPicker({ id, value, onChange, audience }: ResourceKindPickerProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hint = (key: ResourceIcon) => (key === "announcement" ? `A message for ${audience}` : resourceOption(key).hint);
  const chosen = resourceOption(value);
  const ChosenIcon = RESOURCE_ICONS[value];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function openList() {
    setActive(Math.max(0, RESOURCE_OPTIONS.findIndex((o) => o.key === value)));
    setOpen(true);
  }

  function pick(kind: ResourceIcon) {
    onChange(kind);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = RESOURCE_OPTIONS.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => (e.key === "ArrowDown" ? (i >= last ? 0 : i + 1) : i <= 0 ? last : i - 1));
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      const option = RESOURCE_OPTIONS[active];
      if (option) pick(option.key);
    } else if (e.key === "Escape" && open) {
      // closes the list, not the dialog it may be in (Modal listens on window)
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        {...(open ? { "aria-activedescendant": `${listId}-${active}` } : {})}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={clsx("relative flex w-full cursor-pointer items-center gap-3 py-3 pr-9 pl-3 text-left", FIELD)}
      >
        <ChosenIcon className={clsx("size-5 shrink-0", RESOURCE_ICON_TEXT[value])} strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-base font-bold text-ink">{chosen.label}</span>
          <span className="block truncate font-serif text-sm text-soft">{hint(value)}</span>
        </span>
        {/* placed as the shared Select places its own */}
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-soft" strokeWidth={2} aria-hidden />
      </button>
      {open && (
        // over what follows, like a select's menu, with its shadow
        <ul id={listId} role="listbox" aria-label="What are you adding?" className="absolute inset-x-0 top-full z-20 m-0 list-none border border-t-0 border-ink bg-paper p-0 shadow-float">
          {RESOURCE_OPTIONS.map((o, i) => {
            const Icon = RESOURCE_ICONS[o.key];
            const selected = o.key === value;
            return (
              <li
                key={o.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                // keep focus on the button, so the list isn't closed by a blur first
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.key)}
                className={clsx("flex cursor-pointer items-center gap-3 border-b border-faint px-3 py-3 last:border-b-0", i === active && "bg-wash")}
              >
                <Icon className={clsx("size-5 shrink-0", RESOURCE_ICON_TEXT[o.key])} strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-base font-bold text-ink">{o.label}</span>
                  <span className="block font-serif text-sm text-soft">{hint(o.key)}</span>
                </span>
                {selected && <CheckIcon className="size-4 shrink-0 text-ink" strokeWidth={3} aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
