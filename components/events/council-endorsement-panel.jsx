import clsx from "clsx";
import { Eyebrow } from "@/components/shared";
import { MEMBERS } from "@/lib/data";
import { endorsementCount, isConfirmed, neighborhoodMajority } from "@/lib/governance.util";

/* On an upcoming federation council: endorsement badges per neighborhood
   that's signed on, a progress rail toward the majority needed, and (if the
   viewer's own neighborhood hasn't endorsed yet) a button to propose the
   endorsing meeting. Once the council is past, PastCouncilSummary takes
   over instead. */
export function CouncilEndorsementPanel({ event: e, profile, onProposeEndorsingAssembly }) {
  const confirmed = isConfirmed(e);
  const councilMajority = neighborhoodMajority();
  const myHood = profile.neighborhood;
  const endorsed = (e.endorsements || []).includes(myHood);

  return (
    <div className={clsx("mt-6 border p-5", confirmed ? "border-leaf" : "border-flame")}>
      <Eyebrow className={confirmed ? "text-leaf" : "text-flame"}>Neighborhood endorsements</Eyebrow>
      <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-[#222]">
        A federation council meeting is confirmed once a majority of neighborhoods endorse it — <strong>{councilMajority}</strong> of {new Set(MEMBERS.map((m) => m.neighborhood)).size}. Each neighborhood endorses by passing a meeting vote of its own.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2">
        {(e.endorsements || []).map((hood) => (
          <span key={hood} className="border border-leaf px-2.75 py-1.5 font-sans text-eyebrow font-bold tracking-[0.04em] text-leaf">
            ✓ {hood}
          </span>
        ))}
        {(e.endorsements || []).length === 0 && (
          <span className="font-serif text-sm text-soft">No endorsements yet.</span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3.5">
        <div className="h-1.5 min-w-40 max-w-80 flex-1 bg-faint">
          <div
            className={clsx("h-1.5 transition-[width] duration-300", confirmed ? "bg-leaf" : "bg-flame")}
            style={{ width: `${Math.min(100, (endorsementCount(e) / councilMajority) * 100)}%` }}
          />
        </div>
        {!endorsed && myHood && (
          <button
            onClick={() => onProposeEndorsingAssembly(e, myHood)}
            className="btn-invert btn-ink cursor-pointer whitespace-nowrap border border-flame bg-flame px-4 py-2.75 font-sans text-eyebrow font-bold uppercase tracking-[0.08em] text-paper"
          >
            Propose {myHood} meeting →
          </button>
        )}
        {endorsed && (
          <span className="font-sans text-eyebrow font-bold uppercase tracking-[0.04em] text-leaf">
            ✓ {myHood} endorsed
          </span>
        )}
      </div>
    </div>
  );
}
