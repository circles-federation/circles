"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { DateTile, type DateTileAccent } from "./date-tile";
import type { Event } from "@/lib/types";

type RowAccent = "transparent" | "soft" | "flame" | "leaf";

interface EventRowProps {
  e: Event;
  onOpenEvent: (e: Event) => void;
  dateAccent?: DateTileAccent;
  rowAccent?: RowAccent;
  tags?: ReactNode;
  title: ReactNode;
  titleMuted?: boolean;
  meta: ReactNode;
  metaMuted?: boolean;
  right?: ReactNode;
}

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name. A row's own accent (its
// left border) is a separate concept from DateTile's
// own accent, even though callers often pass the same key to both — a
// row is accented for governance state, DateTile for the date tile's own
// look, and they don't always agree (see ordinary-row.tsx, where a past
// event tints its DateTile "soft" but leaves the row's own border transparent).
const ROW_ACCENT: Record<RowAccent, string> = {
  transparent: "border-l-transparent",
  soft: "border-l-soft",
  flame: "border-l-flame",
  leaf: "border-l-leaf",
};

/* Shared shell for one event-list row (see OrdinaryRow): a
   DateTile, an eyebrow/tag row, a title, a meta line, and a right-aligned
   status block, wrapped in a bordered row that opens the event on click.
   Each caller supplies its own tag/status content and title/meta text —
   this only owns the shape and the accent treatment. */
export function EventRow({ e, onOpenEvent, dateAccent, rowAccent = "transparent", tags, title, titleMuted = false, meta, metaMuted = false, right }: EventRowProps) {
  return (
    <div className={clsx(
      // border-b-ink (not the border-ink shorthand) on purpose: the
      // shorthand also sets border-left-color, which would fight
      // the accent's border below over the same property
      "flex items-start gap-4.5 border-b border-b-ink py-5",
      // a plain row has no side edges, so no side padding either (as circle
      // resources' rows): its content runs flush with the list. Only an
      // accented one is inset, and only on its left, beside its bar: the right
      // stays flush, so its status (Attending, ...) lines up with the others'.
      rowAccent !== "transparent" && ["border-l-4 pl-4", ROW_ACCENT[rowAccent]],
    )}>
      <DateTile iso={e.date} accent={dateAccent} />
      <button
        onClick={() => onOpenEvent(e)}
        className="flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">{tags}</div>
        <div className={clsx("mt-1.75 mb-1.5 font-sans text-lg min-[720px]:text-xl font-extrabold tracking-[-0.025em] leading-[1.05]", titleMuted ? "text-soft" : "text-ink")}>
          {title}
        </div>
        <div className={clsx("font-serif text-sm", metaMuted ? "text-soft" : "text-[#222]")}>
          {meta}
        </div>
      </button>
      {/* one row of status icons (cancelled, then attending), centred on the
          time eyebrow: the eyebrow's line is 18px and this row 20px (a
          status badge's height), so it starts 1px higher. Only this column
          moves, so the eyebrow-to-title gap doesn't change. */}
      <div className="-mt-px flex h-5 shrink-0 items-center gap-2">
        {right}
      </div>
    </div>
  );
}
