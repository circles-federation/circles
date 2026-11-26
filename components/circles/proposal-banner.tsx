"use client";

import Link from "next/link";
import clsx from "clsx";
import { ChevronRightIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import { fmtDateTime } from "@/lib/format.util";
import { useCirclesById } from "@/lib/hooks";
import { awaitingResponse, proposalTitle } from "@/lib/proposals.util";
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
   when, whether it's waiting on the viewer's answer, and what it proposes in
   a few words (a circle can have several open: a change, and events) — the
   detail is on the proposal's own page. Orange, the app's color for something waiting on its
   members' decision. Opens the proposal. On its
   circle's page, and on Home for each one waiting on you. */
export function ProposalBanner({ proposal: p, memberId, circleName, className }: ProposalBannerProps) {
  const byId = useCirclesById();
  const waiting = awaitingResponse(p, memberId, byId);
  return (
    <Link
      href={`/proposals/${p.id}`}
      className={clsx("flame-press flex items-center gap-3 border border-ink bg-paper px-4 py-3 text-ink no-underline", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center border border-ink bg-flame text-on-action">
        <HandRaisedIcon className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-sans text-sm font-extrabold text-flame-text">{waiting ? "Your answer is needed" : "Open proposal"}</span>
        <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">
          {circleName && `${circleName} · `}{proposalTitle(p)} · open until {fmtDateTime(new Date(p.closesAt))}
        </span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-flame-text" strokeWidth={2.5} />
    </Link>
  );
}
