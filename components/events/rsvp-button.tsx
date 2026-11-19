import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

interface RsvpButtonProps {
  going?: boolean;
  onToggle: () => void;
  big?: boolean;
  // an event that has already happened can no longer be RSVP'd to
  past?: boolean;
}

/* RSVPing, and nothing else: how many are going is said beside it, not
   inside it, where "RSVP 2" read as one label. */
// the pale-green Going, a status on its own (a guest's "You're going") and inside the button
export const GOING_LOOK = "bg-tint-leaf font-sans text-xs font-bold tracking-caps whitespace-nowrap text-on-action uppercase";

export function RsvpButton({ going, onToggle, big, past }: RsvpButtonProps) {
  const sizeClasses = big ? "py-3 px-6" : "py-3 px-4";

  if (past) {
    return (
      <div
        title="This event has already happened"
        className={clsx(
          "ink-press-badge inline-flex cursor-not-allowed items-center gap-3 border border-faint bg-paper font-sans text-xs font-bold tracking-caps whitespace-nowrap text-soft uppercase",
          sizeClasses,
        )}
      >
        <span className="inline-flex items-center gap-1">
          {going && <CheckIcon className="size-4" strokeWidth={3} />}
          {going ? "Attended" : "Ended"}
        </span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={clsx(
        "inline-flex cursor-pointer items-center gap-3 border border-ink font-sans text-xs font-bold tracking-caps whitespace-nowrap uppercase",
        sizeClasses,
        "ink-press",
        // inside a pressed row (Up next) it keeps its own fill and text colour
        going ? clsx("status-pill-pale", GOING_LOOK) : "ink-press-badge bg-paper text-ink",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {going && <CheckIcon className="size-4" strokeWidth={3} />}
        {going ? "Going" : "RSVP"}
      </span>
    </button>
  );
}
