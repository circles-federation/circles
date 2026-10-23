"use client";

import type { ReactNode } from "react";
import { EnvelopeIcon, HandRaisedIcon, InboxIcon } from "@heroicons/react/24/outline";
import { LinkRow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { fmtDateTime } from "@/lib/format.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import { awaitingResponse, proposalTitle } from "@/lib/proposals.util";
import { HomeSection } from "./home-section";

// a row's icon, in the room LinkRow keeps for a picture
function RowIcon({ children }: { children: ReactNode }) {
  return <span className="flex w-6 shrink-0 justify-center">{children}</span>;
}

/* Everything on Home that's waiting on someone, as one list: first what's
   waiting on you (an admin's reviews, proposals to answer, invitations),
   which lights the Home tab's dot, then your own proposals still open,
   quieter, since they wait on others (and are the way back to an undecided
   meeting, which is in no list). Nothing at all, and there's no section. */
export function NeedsYou() {
  const { pendingReviews, invitations, proposals, profile } = useAppState();
  const byId = useCirclesById();
  const memberById = useMemberById();
  // soonest to close first
  const awaitingMe = proposals.filter((p) => awaitingResponse(p, profile.id)).sort((a, b) => a.closesAt.localeCompare(b.closesAt));
  const mineOpen = proposals.filter((p) => p.status === "open" && p.proposerId === profile.id).sort((a, b) => a.closesAt.localeCompare(b.closesAt));
  const myInvitations = invitations.filter((i) => i.memberId === profile.id);
  const reviews = pendingReviews ?? 0;

  const needed = reviews + awaitingMe.length + myInvitations.length;
  if (needed === 0 && mineOpen.length === 0) return null;

  return (
    <HomeSection label={needed > 0 ? "Needs you" : "Your proposals"} {...(needed > 0 ? { count: needed, attention: true } : {})}>
      <div className="border-t border-ink">
        {reviews > 0 && (
          <LinkRow
            href="/admin/review"
            image={<RowIcon><InboxIcon className="size-5" strokeWidth={2} aria-hidden /></RowIcon>}
            title={reviews === 1 ? "1 waiting for review" : `${reviews} waiting for review`}
            detail="Applications and new photos"
          />
        )}
        {awaitingMe.map((p) => (
          <LinkRow
            key={p.id}
            href={`/proposals/${p.id}`}
            image={<RowIcon><HandRaisedIcon className="size-5 text-flame" strokeWidth={2} aria-hidden /></RowIcon>}
            title={proposalTitle(p)}
            detail={`${byId[p.circleId]?.name ?? "A circle"} · answer by ${fmtDateTime(new Date(p.closesAt))}`}
          />
        ))}
        {myInvitations.map((inv) => {
          const by = inv.invitedBy !== undefined ? memberById(inv.invitedBy) : undefined;
          return (
            <LinkRow
              key={inv.id}
              href={`/invitations/${inv.id}`}
              image={<RowIcon><EnvelopeIcon className="size-5" strokeWidth={2} aria-hidden /></RowIcon>}
              title={`Join ${inv.circleName}`}
              detail={by ? `Invited by ${by.name}` : "You’re invited"}
            />
          );
        })}
        {mineOpen.map((p) => (
          <LinkRow
            key={p.id}
            href={`/proposals/${p.id}`}
            image={<RowIcon><HandRaisedIcon className="size-5 text-ghost" strokeWidth={2} aria-hidden /></RowIcon>}
            title={<span className="font-semibold">{proposalTitle(p)}</span>}
            detail={`Waiting on ${byId[p.circleId]?.name ?? "its circle"} · yours`}
          />
        ))}
      </div>
    </HomeSection>
  );
}
