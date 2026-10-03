import Link from "next/link";
import clsx from "clsx";
import { ChevronRightIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import { fmtDateTime } from "@/lib/format.util";
import { awaitingResponse } from "@/lib/proposals.util";
import type { CircleProposal } from "@/lib/types";

interface ProposalBannerProps {
  proposal: CircleProposal;
  memberId: number;
  // named where proposals from several circles are listed together (Home);
  // left out on the circle's own page
  circleName?: string;
  className?: string;
}

/* An open proposal, for its circle's members (the only ones sent it): until
   when, and whether it's waiting on the viewer's answer — not what it
   proposes, which the proposal's own page says, so it stays short. Orange, the app's color for something waiting on its
   members' decision (as a vote to approve is). Opens the proposal. On its
   circle's page, and on Home for each one waiting on you. */
export function ProposalBanner({ proposal: p, memberId, circleName, className }: ProposalBannerProps) {
  const waiting = awaitingResponse(p, memberId);
  return (
    <Link
      href={`/proposals/${p.id}`}
      className={clsx("flame-press flex items-center gap-3 border border-flame border-l-4 border-l-flame px-4.5 py-4 text-ink no-underline", className)}
    >
      <HandRaisedIcon className="size-5 shrink-0 text-flame" strokeWidth={2} />
      <span className="min-w-0 flex-1">
        <span className="font-sans text-sm font-extrabold text-flame">{waiting ? "Your answer is needed" : "Open proposal"}</span>
        <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">
          {circleName && `${circleName} · `}Open until {fmtDateTime(new Date(p.closesAt))}
        </span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-flame" strokeWidth={2.5} />
    </Link>
  );
}
