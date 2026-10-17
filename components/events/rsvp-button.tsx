import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { togglePress } from "@/components/shared";

interface RsvpButtonProps {
  going?: boolean;
  onToggle: () => void;
  big?: boolean;
  // an event that has already happened can no longer be RSVP'd to
  past?: boolean;
}

/* RSVPing, and nothing else: how many are going is said beside it, not
   inside it, where "RSVP 2" read as one label. */
export function RsvpButton({ going, onToggle, big, past }: RsvpButtonProps) {
  const sizeClasses = big ? "py-3 px-6" : "py-3 px-4";

  if (past) {
    return (
      <div
        title="This event has already happened"
        className={clsx(
          "inline-flex cursor-not-allowed items-center gap-3 border border-faint bg-paper font-sans text-xs font-bold tracking-caps whitespace-nowrap text-soft uppercase",
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
        togglePress(!!going),
        going ? "bg-ink text-paper" : "bg-paper text-ink",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {going && <CheckIcon className="size-4" strokeWidth={3} />}
        {going ? "Going" : "RSVP"}
      </span>
    </button>
  );
}
