"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { GovernanceProposalForm } from "@/components/events/governance-proposal-form.page";
import { useAppState } from "@/components/providers/app-state-provider";

/* One route serves both governance-proposal flows: a confirmed assembly
   proposes a federation council (mode "council"), and a federation council
   gets an endorsing assembly proposed in the viewer's neighborhood (mode
   "assembly"). Which one applies is fully determined by the event's own
   kind, so there's no need for the mode to be part of the URL. */
export default function Page() {
  const { id } = useParams();
  const router = useRouter();
  const { events, profile, proposeCouncilDraft, proposeEndorsingAssembly } = useAppState();

  const event = events.find((e) => e.id === id);
  if (!event || (event.kind !== "assembly" && event.kind !== "council")) notFound();

  const mode = event.kind === "assembly" ? "council" : "assembly";
  const hood = mode === "assembly" ? profile.neighborhood : undefined;

  // replace, not push: the form is done with, so its history entry should be
  // too — otherwise the resulting event's back button (router.back()) lands
  // back on the now-stale, already-submitted form instead of wherever this
  // propose flow was actually opened from.
  function handleSubmit(details) {
    if (mode === "council") {
      proposeCouncilDraft(event, details);
      router.replace(`/events/${event.id}`);
    } else {
      const created = proposeEndorsingAssembly(event, details, hood);
      router.replace(`/events/${created.id}`);
    }
  }

  return (
    <GovernanceProposalForm
      mode={mode}
      context={event}
      hood={hood}
      onSubmit={handleSubmit}
      onCancel={() => router.push(`/events/${event.id}`)}
    />
  );
}
