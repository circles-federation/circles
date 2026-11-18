"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { EnvelopeIcon, HandRaisedIcon, InboxIcon, InboxStackIcon } from "@heroicons/react/24/outline";
import { LinkRow, BOXED_LIST } from "@/components/shared";
import { fmtDateTime } from "@/lib/format.util";
import { useCirclesById, useMemberById, useNeedsYou } from "@/lib/hooks";
import { proposalTitle } from "@/lib/proposals.util";
import { HomeSection } from "./home-section";

// a row's icon, in the room LinkRow keeps for a picture
function RowIcon({ children, tone = "paper" }: { children: ReactNode; tone?: "flame" | "paper" | "quiet" }) {
  return (
    <span
      className={clsx(
        "flex size-9 shrink-0 items-center justify-center border",
        tone === "flame" && "border-ink bg-flame text-on-action",
        tone === "paper" && "border-ink bg-paper text-ink",
        tone === "quiet" && "border-faint bg-wash text-soft",
      )}
    >
      {children}
    </span>
  );
}

/* Everything on Home that's waiting on someone, as one list: first what's
   waiting on you (an admin's reviews, proposals to answer, messages to
   your circles' Inboxes not yet opened, invitations),
   which lights the Home tab's dot, then your own proposals still open,
   quieter, since they wait on others (and are the way back to an undecided
   meeting, which is in no list). Nothing at all, and there's no section. */
export function NeedsYou() {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const { reviews, awaitingMe, myInvitations, mineOpen, unreadMessages, count: needed } = useNeedsYou();
  if (needed === 0 && mineOpen.length === 0) return null;

  return (
    <HomeSection label={needed > 0 ? "Needs you" : "Your proposals"} {...(needed > 0 ? { count: needed, attention: true } : {})}>
      <div className={BOXED_LIST}>
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
            image={<RowIcon tone="flame"><HandRaisedIcon className="size-5" strokeWidth={2} aria-hidden /></RowIcon>}
            title={proposalTitle(p)}
            detail={`${byId[p.circleId]?.name ?? "A circle"} · answer by ${fmtDateTime(new Date(p.closesAt))}`}
          />
        ))}
        {unreadMessages.map(({ circleId, count }) => (
          <LinkRow
            key={`inbox-${circleId}`}
            href={`/circles/${circleId}/inbox`}
            image={<RowIcon><InboxStackIcon className="size-5" strokeWidth={2} aria-hidden /></RowIcon>}
            title={count === 1 ? "1 new message" : `${count} new messages`}
            detail={`To ${byId[circleId]?.name ?? "your circle"}`}
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
            image={<RowIcon tone="quiet"><HandRaisedIcon className="size-5" strokeWidth={2} aria-hidden /></RowIcon>}
            title={<span className="font-semibold">{proposalTitle(p)}</span>}
            detail={`Waiting on ${byId[p.circleId]?.name ?? "its circle"} · yours`}
          />
        ))}
      </div>
    </HomeSection>
  );
}
