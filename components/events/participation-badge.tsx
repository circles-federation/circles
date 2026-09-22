import { CheckCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

interface ParticipationBadgeProps {
  // "attending": the member is going to (or went to) the event. "approved": the
  // member has voted to approve an event or meeting that's still awaiting it.
  kind: "attending" | "approved";
  // the event is over — "Attended" rather than "Attending", and muted like the
  // rest of a past row
  past?: boolean;
  className?: string;
}

/* Shown in an event row's right-hand block to say where the signed-in member
   stands on it: attending it, or having approved it while it waits on its
   vote. Says nothing at all when neither is true — a row full of "Not
   attending" would be noise. */
export function ParticipationBadge({ kind, past, className }: ParticipationBadgeProps) {
  return (
    <div className={clsx("inline-flex items-center gap-1.5 font-sans text-sm font-extrabold whitespace-nowrap", past ? "text-soft" : "text-ink", className)}>
      <CheckCircleIcon className="size-5 min-[720px]:size-4" strokeWidth={2} />
      <span className="hidden min-[720px]:inline">
        {kind === "approved" ? "Approved" : past ? "Attended" : "Attending"}
      </span>
    </div>
  );
}
