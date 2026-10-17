import clsx from "clsx";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/shared";

interface StatCardProps {
  value: ReactNode;
  label: string;
  onClick?: () => void;
}

/* A compact statistic card: a large Helvetica numeral over its label, short
   enough that a row of them leaves room on a phone's first screen for what
   people come back for (their circles and events). */
export function StatCard({ value, label, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col items-start justify-between gap-2 border border-ink bg-paper p-3 text-left min-[720px]:p-4",
        onClick ? "ink-press cursor-pointer" : "cursor-default",
      )}
    >
      <div className="font-sans text-heading leading-none font-extrabold tracking-[-0.04em]">{value}</div>
      <Eyebrow className="text-soft">{label}</Eyebrow>
    </button>
  );
}
