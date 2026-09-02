import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

/* The "← Label" back/cancel control at the top of every detail page, form,
   and sub-page — same look everywhere, so it's centralized once.

   The outline icon (not solid) is deliberate: solid icons are just a filled
   shape with no stroke, so there's no way to make one heavier. The outline
   set exposes strokeWidth for exactly this, so it's bumped above the
   Heroicons default (1.5) to read at the same visual weight as the
   font-semibold label next to it. */
export function BackButton({ onClick, children, className }: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer",
        "font-sans text-xs tracking-wide uppercase font-semibold text-soft",
        className
      )}
    >
      <ArrowLeftIcon className="size-3.5" strokeWidth={2.5} />
      {children}
    </button>
  );
}
