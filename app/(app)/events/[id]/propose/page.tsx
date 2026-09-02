"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { GovernanceProposalFormPage } from "@/components/events/governance-proposal-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import type { ProposalDetails } from "@/lib/types";

/* One route serves both governance-proposal flows: a confirmed meeting
   proposes a federation council (mode "council"), and a federation council
   gets an endorsing meeting proposed in the viewer's neighborhood (mode
   "assembly"). Which one applies is fully determined by the event's own
   kind, so there's no need for the mode to be part of the URL. */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { events, orgs, profile, proposeCouncilDraft, proposeEndorsingAssembly } = useAppState();

  const event = events.find((e) => e.id === id);
  if (!event || (event.kind !== "meeting" && event.kind !== "council")) notFound();
  // narrowed once here (a plain property/variable read inside a nested
  // closure like handleSubmit below doesn't retain this narrowing on its
  // own — see the equivalent note in event-masthead.tsx), captured by
  // handleSubmit's closure as an already-non-optional Event.
  const confirmedEvent = event;

  const mode = confirmedEvent.kind === "meeting" ? "council" : "assembly";
  const hood = mode === "assembly" ? profile.neighborhood : undefined;
  const sponsorHood = mode === "council" ? orgs.find((o) => o.id === confirmedEvent.orgId)?.neighborhood : undefined;

  // replace, not push: the form is done with, so its history entry should be
  // too — otherwise the resulting event's back button (router.back()) lands
  // back on the now-stale, already-submitted form instead of wherever this
  // propose flow was actually opened from.
  function handleSubmit(details: ProposalDetails) {
    if (mode === "council") {
      proposeCouncilDraft(confirmedEvent, details);
      router.replace(`/events/${confirmedEvent.id}`);
    } else {
      const created = proposeEndorsingAssembly(confirmedEvent, details, hood!);
      router.replace(`/events/${created.id}`);
    }
  }

  return (
    <GovernanceProposalFormPage
      mode={mode}
      context={confirmedEvent}
      hood={hood}
      sponsorHood={sponsorHood}
      onSubmit={handleSubmit}
      onCancel={() => router.push(`/events/${confirmedEvent.id}`)}
    />
  );
}
