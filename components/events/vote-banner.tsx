import clsx from "clsx";
import { VoteButton } from "./vote-button";
import { audienceLabel } from "@/lib/circles.util";
import { eventTypeLabel, isApproved, isProposal, votingCircleName, votingMemberNoun, voteCount, voteThreshold } from "@/lib/governance.util";
import { useCirclesById, useEventEnded } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface VoteBannerProps {
  event: Event;
  voted?: boolean;
  onToggleVote: () => void;
}

/* Progress toward a vote's majority, plus the control to vote. For a circle's
   meeting that's the combined vote+attend control; for a circle-hosted
   proposal it's an approval, and the banner says who can see it meanwhile and
   who it opens up to. */
export function VoteBanner({ event: e, voted, onToggleVote }: VoteBannerProps) {
  const byId = useCirclesById();
  const proposal = isProposal(e);
  const audience = byId[e.circleId];
  const votes = voteCount(e);
  const threshold = voteThreshold(e, byId);
  const approved = isApproved(e, byId);
  // over once it's ended, not just from the next day: nothing more to do on it
  const past = useEventEnded(e);

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-faint py-4">
      <div className="min-w-55 flex-1">
        <p className="m-0 font-serif text-base leading-[1.45] text-[#222]">
          {proposal
            ? <>Only {votingMemberNoun(e, byId)} of {votingCircleName(e, byId)} can see this proposal. It needs <strong>{threshold}</strong> approving votes, then it opens to {audience ? audienceLabel(audience) : "its circle"}. <span className="font-bold text-flame">{threshold - votes} more</span> to approve.</>
            : approved
              ? <>Quorum met — this meeting is <span className="font-bold text-leaf">approved</span> for {votingCircleName(e, byId)}.</>
              : <>This {eventTypeLabel(e).toLowerCase()} needs <strong>{threshold}</strong> votes from {votingMemberNoun(e, byId)} of {votingCircleName(e, byId)} to be held. <span className="font-bold text-flame">{threshold - votes} more</span> to approve.</>}
        </p>
        {/* progress rail */}
        <div className="mt-3 h-1.5 bg-faint">
          <div
            className={clsx("h-1.5 transition-[width] duration-300", approved ? "bg-leaf" : "bg-flame")}
            style={{ width: `${Math.min(100, (votes / threshold) * 100)}%` }}
          />
        </div>
      </div>
      <VoteButton
        voted={voted}
        count={votes}
        threshold={threshold}
        onToggle={onToggleVote}
        big
        past={past}
        mode={proposal ? "approve" : "attend"}
      />
    </div>
  );
}
