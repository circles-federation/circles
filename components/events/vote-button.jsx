import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

const BASE = "inline-flex items-center gap-2.25 whitespace-nowrap border font-sans font-bold uppercase tracking-[0.12em]";
const SIZE = { big: "text-eyebrow py-3.5 px-5", small: "text-label py-2.25 px-3.25" };

/* Combined vote + attend control for a neighborhood assembly — voting for
   the meeting is how you indicate you'll be there, so there's only one
   action (see toggleVote in app-state-provider.jsx, which keeps votes and
   RSVPs in lockstep). Stays open even after quorum is met, since people
   can keep joining after confirmation — only closes once the event is
   past. Orange accent while proposed, green once confirmed. */
export function VoteButton({ voted, count, threshold, onToggle, big, eligible = true, ineligibleNote, past }) {
  const confirmed = count >= threshold;
  const size = SIZE[big ? "big" : "small"];
  const countBadge = <span className="font-extrabold opacity-85">{count}/{threshold}</span>;

  if (past) {
    return (
      <div
        title={confirmed ? "This meeting was held" : "This proposal did not reach quorum"}
        className={clsx(BASE, size, "cursor-default bg-paper", confirmed ? "border-leaf text-leaf" : "border-faint text-soft")}
      >
        <span className="inline-flex items-center gap-1.5">
          {confirmed && <CheckIcon className="size-3" strokeWidth={3} />}
          {confirmed ? "Held" : "Lapsed"}
        </span>
        {countBadge}
      </div>
    );
  }

  if (!eligible) {
    return (
      <div title={ineligibleNote} className={clsx(BASE, size, "cursor-not-allowed border-faint bg-paper text-soft")}>
        <span>{count}/{threshold} votes</span>
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      title={confirmed ? "Quorum met — you can still join" : `${threshold - count} more vote${threshold - count === 1 ? "" : "s"} to confirm`}
      className={clsx(
        BASE, size, "cursor-pointer",
        confirmed ? "border-leaf" : "border-flame",
        confirmed
          ? (voted ? "bg-leaf text-paper" : "bg-paper text-leaf")
          : (voted ? "bg-flame text-paper" : "bg-paper text-flame"),
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {voted && <CheckIcon className="size-3" strokeWidth={3} />}
        {voted ? "Going" : "RSVP"}
      </span>
      {countBadge}
    </button>
  );
}
