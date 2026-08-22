import { endorsementCount, isConfirmed, neighborhoodMajority } from "@/lib/governance.util";

/* Brief held/lapsed recap shown only for a federation council meeting that
   has already happened — the live endorsement tracker (CouncilEndorsementPanel)
   only applies while it's still upcoming. */
export function PastCouncilSummary({ event: e }) {
  const confirmed = isConfirmed(e);
  const councilMajority = neighborhoodMajority();

  return (
    <div className="border-b border-faint py-4">
      <p className="m-0 font-serif text-base leading-[1.45] text-[#222]">
        {confirmed
          ? <>This federation council meeting was <span className="font-bold text-leaf">held</span> — endorsed by {endorsementCount(e)} neighborhoods.</>
          : <>This federation council meeting <span className="font-bold text-soft">lapsed</span> — it reached {endorsementCount(e)} of {councilMajority} needed endorsements.</>}
      </p>
    </div>
  );
}
