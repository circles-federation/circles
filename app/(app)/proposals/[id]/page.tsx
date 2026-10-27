"use client";

import { notFound, useParams } from "next/navigation";
import { ProposalPage } from "@/components/circles/proposal.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const nav = useAppNav();
  const { proposals, circles, events, profile, respondToProposal, withdrawProposal, cancelEvent, removeNeighborhoodPost } = useAppState();

  // only those with a say in it (and its proposer) are ever sent a proposal
  // (getProposalsForMember), so to anyone else it doesn't exist
  const proposal = proposals.find((p) => p.id === id);
  const circle = proposal && circles.find((c) => c.id === proposal.circleId);
  if (!proposal || !circle) notFound();
  // an event proposal: its event, while it exists, and withdrawing it
  const event = proposal.eventId ? events.find((e) => e.id === proposal.eventId) : undefined;
  // the circle a neighborhood's change is about, or the one a new Circle became
  const subject = proposal.subjectCircleId ? circles.find((c) => c.id === proposal.subjectCircleId) : undefined;
  const open = proposal.status === "open";

  // who has a say: the circle's members, and for a change its neighborhood
  // decides, that circle's own members too; a new Circle's proposer consented
  // by proposing, whether or not they live there
  const deciders =
    proposal.kind === "change" && subject
      ? [...new Set([...subject.members, ...circle.members])]
      : proposal.kind === "new_circle"
        ? [...new Set([proposal.proposerId, ...circle.members])]
        : circle.members;
  const explainer =
    proposal.kind === "post"
      ? "Once its members consent, it goes on the neighborhood's bulletin for everyone who lives there."
      : proposal.kind === "new_circle"
        ? `A Circle can post to ${circle.name}'s bulletin, so everyone who lives there decides whether it starts.`
        : proposal.kind === "change" && subject
          ? `A Circle in ${circle.name} can post to its bulletin, so everyone who lives there decides this with ${subject.name}'s members.`
          : undefined;

  return (
    <ProposalPage
      proposal={proposal}
      circle={circle}
      deciders={deciders}
      {...(explainer ? { explainer } : {})}
      {...(proposal.kind === "new_circle" && proposal.status === "passed" && subject ? { onOpenStarted: () => nav.openCircle(subject) } : {})}
      memberId={profile.id}
      onOpenCircle={() => nav.openCircle(circle)}
      onOpenMember={(m) => nav.openMember(m)}
      onRespond={(response, reason) => respondToProposal(proposal.id, response, reason)}
      {...(event ? { onOpenEvent: () => nav.openEvent(event) } : {})}
      consentIsRsvp={!!event && !event.roles?.length}
      {...(event && open
        ? { onWithdraw: async () => { const r = await cancelEvent(event.id); return r.ok ? { ok: true as const } : r; } }
        : proposal.kind === "post" && proposal.postId && open
          ? { onWithdraw: () => removeNeighborhoodPost(proposal.postId!) }
          : // a change or a new Circle: its proposer's to take back
            (proposal.kind === "change" || proposal.kind === "new_circle") && open && proposal.proposerId === profile.id
            ? { onWithdraw: () => withdrawProposal(proposal.id) }
            : {})}
    />
  );
}
