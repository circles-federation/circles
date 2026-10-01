import clsx from "clsx";

/* The red dot on a nav tab whose page has something waiting on the member.
   Positioned absolutely: the caller's wrapper is `relative` and passes the
   offsets that put it at that wrapper's top-right corner. */
export function AttentionDot({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("absolute size-2.5 rounded-full bg-[#ff3b30] shadow-[0_0_6px_1px_rgba(255,59,48,0.6)]", className)} />;
}
