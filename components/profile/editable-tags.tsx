"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button, Input } from "@/components/shared";
import { canonicalTag, tagSuggestions } from "@/lib/members.util";

// the list never shrinks below a couple of rows, and stops short of the
// keyboard (or the screen's edge) by a little
const MIN_LIST_PX = 96;
const LIST_MARGIN_PX = 8;
// how long after a finger lifts its click still counts as a pick
const PICK_GRACE_MS = 400;

interface EditableTagsProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  // what other members have added of this kind (repeats included): suggested
  // as it's typed, and what's added takes the form they already use
  pool?: string[];
}

/* An editable list of tags: each removable, with an input to add new ones.
   Given a `pool`, the input is a combobox: matching entries from it are
   listed under it as it's typed (arrow keys and Enter, or a tap, to pick
   one; Escape to close). */
export function EditableTags({ values, onChange, placeholder, pool }: EditableTagsProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const suggestions = pool && open ? tagSuggestions(pool, draft, values) : [];
  const inputRef = useRef<HTMLInputElement>(null);
  // set while a finger or the mouse is down on the list: the field blurs
  // before the tap's click lands (on iOS especially), which mustn't close it
  const picking = useRef(false);
  // the room under the field that's actually visible, above an on-screen
  // keyboard, so a long list scrolls in itself rather than hiding under it
  const [room, setRoom] = useState<number | null>(null);
  const showing = suggestions.length > 0;
  useEffect(() => {
    if (!showing) return;
    const viewport = window.visualViewport;
    const measure = () => {
      const field = inputRef.current?.getBoundingClientRect();
      if (!field) return;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      setRoom(Math.max(MIN_LIST_PX, Math.floor(visibleBottom - field.bottom - LIST_MARGIN_PX)));
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [showing]);

  function pick(s: string) {
    picking.current = false;
    add(s);
    // back to the field, so the keyboard stays up for the next one
    inputRef.current?.focus();
  }

  function add(raw: string) {
    const v = pool ? canonicalTag(raw, pool) : raw.trim();
    setDraft("");
    setActive(-1);
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-2 border border-ink py-1 pr-2 pl-3 font-sans text-eyebrow font-semibold">
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="hit inline-flex cursor-pointer border-none bg-transparent p-0 text-soft"
            >
              <XMarkIcon className="size-3" strokeWidth={3} />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="font-serif text-sm text-soft">None yet.</span>}
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              if (!picking.current) setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && suggestions.length > 0) {
                e.preventDefault();
                setActive((i) => (i + 1) % suggestions.length);
              } else if (e.key === "ArrowUp" && suggestions.length > 0) {
                e.preventDefault();
                setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
              } else if (e.key === "Escape" && suggestions.length > 0) {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                add(active >= 0 && suggestions[active] ? suggestions[active] : draft);
              }
            }}
            placeholder={placeholder}
            {...(pool
              ? {
                  role: "combobox",
                  "aria-autocomplete": "list" as const,
                  "aria-expanded": suggestions.length > 0,
                  "aria-controls": listId,
                  ...(active >= 0 ? { "aria-activedescendant": `${listId}-${active}` } : {}),
                }
              : {})}
          />
          {suggestions.length > 0 && (
            // over what follows, like a select's menu, with its shadow
            <ul
              id={listId}
              role="listbox"
              onPointerDown={() => (picking.current = true)}
              onPointerUp={() => setTimeout(() => (picking.current = false), PICK_GRACE_MS)}
              onPointerCancel={() => (picking.current = false)}
              style={room !== null ? { maxHeight: room } : undefined}
              className="absolute inset-x-0 top-full z-20 m-0 list-none overflow-y-auto overscroll-contain border border-t-0 border-ink bg-paper p-0 shadow-float"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // the mouse keeps the field focused; a tap blurs it, but
                  // `picking` keeps the list open until its click lands
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx("cursor-pointer border-b border-faint px-3 py-3 font-serif text-base last:border-b-0", i === active && "bg-wash")}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button variant="secondary" size="compact" disabled={!draft.trim()} onMouseDown={(e) => e.preventDefault()} onClick={() => add(draft)}>
          Add
        </Button>
      </div>
    </div>
  );
}
