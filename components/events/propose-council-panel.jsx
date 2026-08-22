import clsx from "clsx";
import { Eyebrow } from "@/components/shared";
import { COUNCIL_RATIFY_THRESHOLD } from "@/lib/data";
import { fmtEditDate } from "@/lib/format.util";
import { canVote, scopeLabel } from "@/lib/governance.util";

/* One drafted-council card: ratification progress, or (once ratified) a
   link through to the real council event it became. Private to
   ProposeCouncilPanel — not used anywhere else. */
function CouncilProposalCard({ proposal: p, event: e, profile, events, onRatifyProposal, onOpenEvent }) {
  const isResident = canVote(e, profile);
  const rv = p.ratifyVotes.length;
  const ratified = p.ratified;
  const mineVoted = p.ratifyVotes.includes(profile.id);

  return (
    <div className={clsx("border-l-4 p-3.5", ratified ? "border border-leaf border-l-leaf" : "border border-faint border-l-flame")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-sans text-base font-extrabold">{p.title}</span>
        <span className={clsx("font-sans text-label font-bold uppercase tracking-[0.08em]", ratified ? "text-leaf" : "text-flame")}>
          {ratified ? "✓ Ratified" : `Ratifying · ${rv}/${COUNCIL_RATIFY_THRESHOLD}`}
        </span>
      </div>
      <p className="mt-1.5 font-serif text-sm leading-[1.4] text-soft">
        {p.date ? `${fmtEditDate(p.date)} · ` : ""}{p.location}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {!ratified ? (
          <>
            <div className="h-1.5 min-w-35 max-w-70 flex-1 bg-faint">
              <div className="h-1.5 bg-flame transition-[width] duration-300" style={{ width: `${Math.min(100, (rv / COUNCIL_RATIFY_THRESHOLD) * 100)}%` }} />
            </div>
            {isResident ? (
              <button
                onClick={() => onRatifyProposal(p.id)}
                className={clsx(
                  "cursor-pointer whitespace-nowrap border border-flame px-3.5 py-2.25 font-sans text-eyebrow font-bold uppercase tracking-[0.08em]",
                  mineVoted ? "bg-flame text-paper" : "bg-paper text-flame",
                )}
              >
                {mineVoted ? "✓ Ratified by you" : "Ratify"}
              </button>
            ) : (
              <span className="font-sans text-eyebrow text-soft">Only {scopeLabel(e)} can ratify</span>
            )}
          </>
        ) : (
          <button
            onClick={() => { const c = (events || []).find((x) => x.id === p.councilId); if (c) onOpenEvent(c); }}
            className="cursor-pointer whitespace-nowrap border border-leaf bg-leaf px-3.5 py-2.25 font-sans text-eyebrow font-bold uppercase tracking-[0.08em] text-paper"
          >
            View federation council meeting →
          </button>
        )}
      </div>
    </div>
  );
}

/* On a confirmed assembly: lets a resident draft a federation council
   meeting, and lists this assembly's own drafts with their ratification
   progress. Feature-flagged off entirely when federation council isn't
   enabled — see event.page.jsx's FEDERATION_COUNCIL_ENABLED check. */
export function ProposeCouncilPanel({ event: e, profile, proposals, events, onProposeCouncil, onRatifyProposal, onOpenEvent }) {
  const isResident = canVote(e, profile);
  return (
    <div className="mt-6 border border-flame p-5">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="min-w-55 flex-1">
          <Eyebrow className="text-flame">Federation council</Eyebrow>
          <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-[#222]">
            As a confirmed assembly, {scopeLabel(e)} can put forward a federation council meeting. A delegate drafts the proposal; attendees then vote to ratify it.
          </p>
        </div>
        {isResident && (
          <button
            onClick={() => onProposeCouncil(e)}
            className="btn-invert btn-ink cursor-pointer whitespace-nowrap border border-flame bg-flame px-5 py-3.25 font-sans text-xs font-bold uppercase tracking-wide text-paper"
          >
            Propose
          </button>
        )}
      </div>

      {proposals.length > 0 && (
        <div className="mt-4.5 flex flex-col gap-3">
          {proposals.map((p) => (
            <CouncilProposalCard
              key={p.id}
              proposal={p}
              event={e}
              profile={profile}
              events={events}
              onRatifyProposal={onRatifyProposal}
              onOpenEvent={onOpenEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
