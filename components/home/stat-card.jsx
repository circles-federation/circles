import clsx from "clsx";
import { Eyebrow } from "@/components/shared";

/* A square statistic card: large Helvetica numeral over a label. */
export function StatCard({ value, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex aspect-square w-full flex-col items-stretch justify-between border border-ink bg-paper p-5",
        onClick ? "ink-press cursor-pointer" : "cursor-default",
      )}
    >
      <Eyebrow className="text-left text-soft">{label}</Eyebrow>
      <div className="text-right font-sans text-hero leading-[0.9] font-extrabold tracking-[-0.04em]">
        {value}
      </div>
    </button>
  );
}
