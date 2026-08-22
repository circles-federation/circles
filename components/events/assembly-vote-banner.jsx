import clsx from "clsx";
import { VoteButton } from "./vote-button";
import { isConfirmed, canVote, kindOf, scopeLabel, voteCount } from "@/lib/governance.util";
import { isPastEvent } from "@/lib/format.util";

/* Quorum banner for a neighborhood assembly — progress toward confirmation
   plus the combined vote+attend control. Not shown for councils, which
   confirm by neighborhood endorsement instead (see CouncilEndorsementPanel). */
export function AssemblyVoteBanner({ event: e, profile, voted, onToggleVote }) {
  const k = kindOf(e);
  const votes = voteCount(e);
  const confirmed = isConfirmed(e);
  const eligible = canVote(e, profile);
  const past = isPastEvent(e);

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-faint py-4">
      <div className="min-w-55 flex-1">
        <p className="m-0 font-serif text-base leading-[1.45] text-[#222]">
          {confirmed
            ? <>Quorum met — this meeting is <span className="font-bold text-leaf">confirmed</span> for {scopeLabel(e)}.</>
            : <>This {k.label.toLowerCase()} needs <strong>{k.threshold}</strong> votes from {scopeLabel(e)} to be held. <span className="font-bold text-flame">{k.threshold - votes} more</span> to confirm.</>}
        </p>
        {/* progress rail */}
        <div className="mt-3 h-1.5 bg-faint">
          <div
            className={clsx("h-1.5 transition-[width] duration-300", confirmed ? "bg-leaf" : "bg-flame")}
            style={{ width: `${Math.min(100, (votes / k.threshold) * 100)}%` }}
          />
        </div>
        {!eligible && (
          <p className="mt-2.5 font-sans text-xs leading-[1.4] tracking-[0.02em] text-soft">
            Voting and attending is limited to residents of {scopeLabel(e)}.
          </p>
        )}
      </div>
      <VoteButton
        voted={voted}
        count={votes}
        threshold={k.threshold}
        onToggle={onToggleVote}
        big
        eligible={eligible}
        ineligibleNote={`Only people in ${scopeLabel(e)} can vote on this`}
        past={past}
      />
    </div>
  );
}
