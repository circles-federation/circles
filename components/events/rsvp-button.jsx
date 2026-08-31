import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export function RsvpButton({ going, count, onToggle, big, disabled, reason }) {
  const sizeClasses = big ? "py-3.25 px-6" : "py-2.5 px-3.75";

  if (disabled) {
    const title = reason === "membersOnly"
      ? "Only members of the hosting organization can RSVP to this event"
      : "This event has already happened";
    return (
      <div
        title={title}
        className={clsx(
          "inline-flex cursor-not-allowed items-center gap-2.5 border bg-paper font-sans text-xs font-bold tracking-wide whitespace-nowrap uppercase",
          sizeClasses,
          reason === "membersOnly" ? "border-plum text-plum" : "border-faint text-soft",
        )}
      >
        <span className="inline-flex items-center gap-1">
          {going && <CheckIcon className="size-3" strokeWidth={3} />}
          {reason === "membersOnly" ? "Members only" : (going ? "Went" : "Ended")}
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
        going ? "bg-ink text-paper" : "bg-paper text-ink",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {going && <CheckIcon className="size-3" strokeWidth={3} />}
        {going ? "Going" : "RSVP"}
      </span>
      <span className="font-extrabold opacity-70">{count}</span>
    </button>
  );
}
