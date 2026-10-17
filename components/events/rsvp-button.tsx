import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { togglePress } from "@/components/shared";

interface RsvpButtonProps {
  going?: boolean;
  count: number;
  onToggle: () => void;
  big?: boolean;
  // an event that has already happened can no longer be RSVP'd to
  past?: boolean;
}

export function RsvpButton({ going, count, onToggle, big, past }: RsvpButtonProps) {
  const sizeClasses = big ? "py-3.25 px-6" : "py-2.5 px-3.75";

  if (past) {
    return (
      <div
        title="This event has already happened"
        className={clsx(
          "inline-flex cursor-not-allowed items-center gap-2.5 border border-faint bg-paper font-sans text-xs font-bold tracking-wide whitespace-nowrap text-soft uppercase",
          sizeClasses,
        )}
      >
        <span className="inline-flex items-center gap-1">
          {going && <CheckIcon className="size-3" strokeWidth={3} />}
          {going ? "Attended" : "Ended"}
        </span>
        <span className="font-extrabold opacity-70">{count}</span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={clsx(
        "inline-flex cursor-pointer items-center gap-2.5 border border-ink font-sans text-xs font-bold tracking-wide whitespace-nowrap uppercase",
        sizeClasses,
        togglePress(!!going),
        going ? "bg-ink text-paper" : "bg-paper text-ink",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {going && <CheckIcon className="size-3" strokeWidth={3} />}
        {going ? "Attending" : "RSVP"}
      </span>
      <span className="font-extrabold opacity-70">{count}</span>
    </button>
  );
}
