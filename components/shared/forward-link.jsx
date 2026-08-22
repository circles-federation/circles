import { ArrowRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

/* The small "Label →" link used to point at a fuller view (see-all/see-more)
   — same look everywhere it appears, so it's centralized once. */
export function ForwardLink({ onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer",
        "font-sans text-eyebrow tracking-[0.06em] uppercase font-bold text-ink",
        className
      )}
    >
      {children}
      <ArrowRightIcon className="size-3.5" strokeWidth={2.5} />
    </button>
  );
}
