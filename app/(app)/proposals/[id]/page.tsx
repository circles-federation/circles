"use client";

import { notFound, useParams } from "next/navigation";
import { ProposalPage } from "@/components/circles/proposal.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const nav = useAppNav();
  const { proposals, circles, events, profile, respondToProposal, cancelEvent } = useAppState();

  // only its circle's members are ever sent a proposal (getProposalsForMember),
  // so to anyone else it doesn't exist
  const proposal = proposals.find((p) => p.id === id);
  const circle = proposal && circles.find((c) => c.id === proposal.circleId);
  if (!proposal || !circle) notFound();
  // a group's event proposal: its event, while it exists, and withdrawing it
  const event = proposal.eventId ? events.find((e) => e.id === proposal.eventId) : undefined;

  return (
    <ProposalPage
      proposal={proposal}
      circle={circle}
      memberId={profile.id}
      onOpenCircle={() => nav.openCircle(circle)}
      onOpenMember={(m) => nav.openMember(m)}
      onRespond={(response, reason) => respondToProposal(proposal.id, response, reason)}
      {...(event ? { onOpenEvent: () => nav.openEvent(event) } : {})}
      consentIsRsvp={!!event && !event.roles?.length}
      {...(event && proposal.status === "open"
        ? { onWithdraw: async () => { const r = await cancelEvent(event.id); return r.ok ? { ok: true as const } : r; } }
        : {})}
    />
  );
}
