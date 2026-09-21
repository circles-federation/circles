import clsx from "clsx";
import { MONTHS, WEEKDAYS, parseDay } from "@/lib/format.util";

export type DateTileAccent = "ink" | "soft" | "flame" | "leaf";

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `border-${accent}`
const ACCENT: Record<DateTileAccent, { border: string; bg: string }> = {
  ink: { border: "border-ink", bg: "bg-ink" },
  soft: { border: "border-soft", bg: "bg-soft" },
  flame: { border: "border-flame", bg: "bg-flame" },
  leaf: { border: "border-leaf", bg: "bg-leaf" },
};

interface DateTileProps {
  iso: string;
  large?: boolean;
  accent?: DateTileAccent;
}

/* A small calendar tile used in the list and the detail header. */
export function DateTile({ iso, large, accent = "ink" }: DateTileProps) {
  const d = parseDay(iso);
  const valid = iso && !isNaN(d.getTime());
  const { border, bg } = ACCENT[accent];
  const tileClass = clsx("shrink-0 border bg-paper text-center", large ? "w-21" : "w-14.5", border);
  const badgeClass = clsx("font-sans font-bold text-paper uppercase tracking-[0.18em]", bg, large ? "py-1.25 text-label" : "py-1 text-micro");

  if (!valid) {
    return (
      <div className={tileClass}>
        <div className={badgeClass}>TBD</div>
        <div className={clsx("font-sans font-extrabold tracking-tight leading-[1.1] text-soft", large ? "py-2.5 text-[30px]" : "py-1.75 text-[22px]")}>
          —
        </div>
      </div>
    );
  }

  return (
    <div className={tileClass}>
      <div className={badgeClass}>{MONTHS[d.getMonth()]}</div>
      <div className={clsx("font-sans font-extrabold tracking-tight leading-[1.1]", large ? "pt-1.5 pb-0.5 text-[38px]" : "pt-0.75 text-[26px]")}>
        {d.getDate()}
      </div>
      <div className={clsx("font-sans font-semibold text-soft uppercase tracking-[0.16em]", large ? "pb-1.5 text-[10px]" : "pb-1 text-[8px]")}>
        {WEEKDAYS[d.getDay()]}
      </div>
    </div>
  );
}
