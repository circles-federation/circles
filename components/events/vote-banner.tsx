import clsx from "clsx";
import { VoteButton } from "./vote-button";
import { audienceLabel } from "@/lib/circles.util";
import { eventTypeLabel, isConfirmed, isProposal, scopeLabel, scopeNoun, voteCount, voteThreshold } from "@/lib/governance.util";
import { isPastEvent } from "@/lib/format.util";
import { useCirclesById } from "@/lib/hooks";
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
  const confirmed = isConfirmed(e, byId);
  const past = isPastEvent(e);

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-faint py-4">
      <div className="min-w-55 flex-1">
        <p className="m-0 font-serif text-base leading-[1.45] text-[#222]">
          {proposal
            ? <>Only {scopeNoun(e, byId)} of {scopeLabel(e, byId)} can see this proposal. It needs <strong>{threshold}</strong> approving votes, then it opens to {audience ? audienceLabel(audience) : "its circle"}. <span className="font-bold text-flame">{threshold - votes} more</span> to approve.</>
            : confirmed
              ? <>Quorum met — this meeting is <span className="font-bold text-leaf">confirmed</span> for {scopeLabel(e, byId)}.</>
              : <>This {eventTypeLabel(e).toLowerCase()} needs <strong>{threshold}</strong> votes from {scopeNoun(e, byId)} of {scopeLabel(e, byId)} to be held. <span className="font-bold text-flame">{threshold - votes} more</span> to confirm.</>}
        </p>
        {/* progress rail */}
        <div className="mt-3 h-1.5 bg-faint">
          <div
            className={clsx("h-1.5 transition-[width] duration-300", confirmed ? "bg-leaf" : "bg-flame")}
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
