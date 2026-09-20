import clsx from "clsx";
import { VoteButton } from "./vote-button";
import { isConfirmed, canVote, kindOf, meetingThreshold, scopeLabel, scopeNoun, voteCount } from "@/lib/governance.util";
import { isPastEvent } from "@/lib/format.util";
import { useCirclesById } from "@/lib/hooks";
import type { Event, Profile } from "@/lib/types";

interface MeetingVoteBannerProps {
  event: Event;
  profile: Profile;
  voted?: boolean;
  onToggleVote: () => void;
}

/* Quorum banner for a circle's meeting — progress toward confirmation plus
   the combined vote+attend control. */
export function MeetingVoteBanner({ event: e, profile, voted, onToggleVote }: MeetingVoteBannerProps) {
  const byId = useCirclesById();
  const k = kindOf(e);
  const votes = voteCount(e);
  const threshold = meetingThreshold(e, byId);
  const confirmed = isConfirmed(e, byId);
  const eligible = canVote(e, profile, byId);
  const past = isPastEvent(e);

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-faint py-4">
      <div className="min-w-55 flex-1">
        <p className="m-0 font-serif text-base leading-[1.45] text-[#222]">
          {confirmed
            ? <>Quorum met — this meeting is <span className="font-bold text-leaf">confirmed</span> for {scopeLabel(e, byId)}.</>
            : <>This {k.label.toLowerCase()} needs <strong>{threshold}</strong> votes from {scopeNoun(e, byId)} of {scopeLabel(e, byId)} to be held. <span className="font-bold text-flame">{threshold - votes} more</span> to confirm.</>}
        </p>
        {/* progress rail */}
        <div className="mt-3 h-1.5 bg-faint">
          <div
            className={clsx("h-1.5 transition-[width] duration-300", confirmed ? "bg-leaf" : "bg-flame")}
            style={{ width: `${Math.min(100, (votes / threshold) * 100)}%` }}
          />
        </div>
        {!eligible && (
          <p className="mt-2.5 font-sans text-xs leading-[1.4] tracking-[0.02em] text-soft">
            Voting and attending is limited to {scopeNoun(e, byId)} of {scopeLabel(e, byId)}.
          </p>
        )}
      </div>
      <VoteButton
        voted={voted}
        count={votes}
        threshold={threshold}
        onToggle={onToggleVote}
        big
        eligible={eligible}
        ineligibleNote={`Only ${scopeNoun(e, byId)} of ${scopeLabel(e, byId)} can vote on this`}
        past={past}
      />
    </div>
  );
}
