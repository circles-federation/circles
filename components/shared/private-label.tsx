import type { ReactNode } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";

// a label with a lock after it, marking something private — the Groups grid and
// a group's own masthead (a group is visible only to its members)
export function PrivateLabel({ children }: { children: ReactNode }) {
  return (
    // leading-none and -translate-y-px: the labels are all capitals, which sit
    // above the middle of their line, so the lock is centred on the capitals
    // rather than on the line
    <span className="inline-flex items-center gap-1.5 leading-none">
      {children}
      <LockClosedIcon className="size-3.5 shrink-0 -translate-y-px" strokeWidth={2.25} aria-label="Private" />
    </span>
  );
}
