import type { ReactNode } from "react";

/* Consistent page header: a large Helvetica title on the left, optional
   actions on the right, a hairline rule beneath. The row is a FIXED height with
   everything vertically centered, so the rule always sits the same distance
   below the title — whether the right slot holds small text, a tall button, or
   nothing. Items never wrap (a right-side button stays on the title's line). */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-12 flex-nowrap items-center justify-between gap-4 border-b border-ink pb-4">
      <h2 className="truncate font-sans text-heading leading-[1.15] font-extrabold tracking-tight">{title}</h2>
      {children && <div className="flex shrink-0 items-center gap-4.5">{children}</div>}
    </div>
  );
}
