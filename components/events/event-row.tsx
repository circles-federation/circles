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
  washed?: boolean;
  tags?: ReactNode;
  title: ReactNode;
  titleMuted?: boolean;
  meta: ReactNode;
  metaMuted?: boolean;
  right?: ReactNode;
}

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name. A row's own accent (its
// left border + background wash) is a separate concept from DateTile's
// own accent, even though callers often pass the same key to both — a
// row is accented for governance state, DateTile for the date tile's own
// look, and they don't always agree (see ordinary-row.tsx, where a past
// event tints its DateTile "soft" but leaves the row's own border transparent).
const ROW_ACCENT: Record<RowAccent, { borderL: string; wash: string }> = {
  transparent: { borderL: "border-l-transparent", wash: "" },
  soft: { borderL: "border-l-soft", wash: "" },
  flame: { borderL: "border-l-flame", wash: "bg-flame/[3.5%]" },
  leaf: { borderL: "border-l-leaf", wash: "bg-leaf/5" },
};

/* Shared shell for one event-list row (see OrdinaryRow, GovernanceRow): a
   DateTile, an eyebrow/tag row, a title, a meta line, and a right-aligned
   count block, wrapped in a bordered row that opens the event on click.
   Each caller supplies its own tag/count content and title/meta text —
   this only owns the shape and the accent/wash treatment. */
export function EventRow({ e, onOpenEvent, dateAccent, rowAccent = "transparent", washed = false, tags, title, titleMuted = false, meta, metaMuted = false, right }: EventRowProps) {
  const accent = ROW_ACCENT[rowAccent];
  return (
    <div className={clsx(
      // border-b-ink (not the border-ink shorthand) on purpose: the
      // shorthand also sets border-left-color, which would fight
      // accent.borderL below over the same property
      "flex items-start gap-4.5 border-b border-b-ink border-l-4 py-5 pr-5.5 pl-4",
      accent.borderL,
      washed && accent.wash,
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
      <div className="shrink-0 pt-1 text-right">
        {right}
      </div>
    </div>
  );
}
