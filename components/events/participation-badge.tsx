import { CheckCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

interface ParticipationBadgeProps {
  // the member is going to (or went to) the event
  kind: "attending";
  // the event is over — "Attended" rather than "Attending", and muted like the
  // rest of a past row
  past?: boolean;
  className?: string;
}

/* Shown in an event row's right-hand block to say where the signed-in member
   stands on it: attending it. Says nothing at all otherwise — a row full of
   "Not attending" would be noise. */
export function ParticipationBadge({ past, className }: ParticipationBadgeProps) {
  return (
    <div className={clsx("inline-flex items-center gap-1.5 font-sans text-sm font-extrabold whitespace-nowrap", past ? "text-soft" : "text-ink", className)}>
      <CheckCircleIcon className="size-5 min-[720px]:size-4" strokeWidth={2} />
      <span className="hidden min-[720px]:inline">
        {past ? "Attended" : "Attending"}
      </span>
    </div>
  );
}
