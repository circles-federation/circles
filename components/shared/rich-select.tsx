"use client";

import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { FIELD } from "./input";

export interface RichOption<T extends string> {
  value: T;
  label: string;
  // a line on what it is, under its name (none where the name says it all)
  hint?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  // the icon's own colour, where it has one (a bulletin kind's)
  iconClassName?: string;
}

interface RichSelectProps<T extends string> {
  id?: string;
  options: RichOption<T>[];
  // null shows the placeholder, for a choice with no default
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  // the list's name for screen readers ("What are you adding?")
  label: string;
}

/* A choice from options that each want a word more than their name (what
   kind of circle, what kind of bulletin item, a language in its own name):
   a field-styled button showing the one chosen, opening a list under it of
   each option's icon, name and a line on what it is, which a native select
   can't show. A long list scrolls in itself. Arrow keys move through it, Enter or Space picks, Escape or a tap elsewhere closes it, and
   focus stays on the button throughout. */
export function RichSelect<T extends string>({ id, options, value, onChange, placeholder = "Choose one", label }: RichSelectProps<T>) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // the room under the field as it opens, so a long list ends on the screen
  // (never shorter than four rows or so, scrolling the page for the rest)
  const [room, setRoom] = useState<number | null>(null);
  const chosen = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // a long list scrolls in itself: keep the one the keys are on in view
  useEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector(`#${CSS.escape(`${listId}-${active}`)}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function openList() {
    const box = wrapRef.current?.getBoundingClientRect();
    const viewport = window.visualViewport?.height ?? window.innerHeight;
    setRoom(box ? Math.max(256, viewport - box.bottom - 24) : null);
    // the one chosen, if any: nothing's highlighted until there's a reason
    setActive(options.findIndex((o) => o.value === value));
    setOpen(true);
  }

  function pick(next: T) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => (e.key === "ArrowDown" ? (i >= last || i < 0 ? 0 : i + 1) : i <= 0 ? last : i - 1));
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      const option = options[active];
      if (option) pick(option.value);
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
        {...(open && active >= 0 ? { "aria-activedescendant": `${listId}-${active}` } : {})}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={clsx("relative flex w-full cursor-pointer items-center gap-3 py-3 pr-9 pl-3 text-left", FIELD)}
      >
        {chosen ? (
          <>
            {chosen.icon && <chosen.icon className={clsx("size-5 shrink-0", chosen.iconClassName)} strokeWidth={2} aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block font-sans text-base font-bold text-ink">{chosen.label}</span>
              {chosen.hint && <span className="block truncate font-serif text-sm text-soft">{chosen.hint}</span>}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 font-serif text-base text-soft">{placeholder}</span>
        )}
        {/* placed as the shared Select places its own */}
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-soft" strokeWidth={2} aria-hidden />
      </button>
      {open && (
        // dropped a little below the field like the top bar's menu (TopBarMenu):
        // no outline, its shadow, grown from the field as it opens
        <ul ref={listRef} id={listId} role="listbox" aria-label={label} style={room ? { maxHeight: Math.min(room, 384) } : undefined}
          className="absolute inset-x-0 top-full z-20 m-0 mt-2 max-h-96 origin-top animate-menu-in list-none overflow-y-auto overscroll-contain bg-raised p-0 shadow-float">
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                // keep focus on the button, so the list isn't closed by a blur first
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={clsx("flex cursor-pointer items-center gap-3 px-4 py-3", i > 0 && "border-t border-faint", i === active && "bg-wash")}
              >
                {o.icon && <o.icon className={clsx("size-5 shrink-0", o.iconClassName)} strokeWidth={2} aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-base font-semibold text-ink">{o.label}</span>
                  {o.hint && <span className="block font-serif text-sm text-soft">{o.hint}</span>}
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
