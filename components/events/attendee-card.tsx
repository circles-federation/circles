import clsx from "clsx";
import type { ReactNode } from "react";

// the grid of attendee cards, ruled on its top and left so each card adds its own right and bottom
export const ATTENDEE_GRID = "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,248px),1fr))] gap-0 border-t border-l border-ink p-0";
export const ATTENDEE_CARD = "flex items-center gap-3 border-0 border-r border-b border-ink p-4 text-left";

/* What's inside an attendee's card, wherever the meeting shows people (the
   Attendance step, the Finish step): their photo, name with an optional badge,
   and a line under it. The card itself (a button or not) is the caller's. */
export function AttendeeCardContent({ avatar, name, badge, caption, className }: { avatar: ReactNode; name: ReactNode; badge?: ReactNode; caption?: ReactNode; className?: string }) {
  return (
    <>
      {avatar}
      <span className={clsx("min-w-0 flex-1", className)}>
        <span className="flex flex-wrap items-center gap-2 font-sans text-sm font-bold">
          {name}
          {badge}
        </span>
        {caption && <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{caption}</span>}
      </span>
    </>
  );
}
