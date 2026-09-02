import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

/* Wraps a run of Sections and owns the hairline rules between them (via
   Tailwind's divide-y, so a lone or last Section never ends up with a
   dangling border of its own) — dividers only appear between Sections, never
   trailing after the last one. */
export function SectionGroup({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={clsx("divide-y divide-faint", className)} {...rest}>
      {children}
    </div>
  );
}
