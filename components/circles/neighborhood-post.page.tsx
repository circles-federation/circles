"use client";

import { useState } from "react";
import { CheckIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import { ConfirmModal, FederationExplorerField, Label, PageContainer, useFederationExplorer } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { useCircles } from "@/lib/hooks";
import { validateResourceInput } from "@/lib/resources.util";
import type { Circle } from "@/lib/types";
import { ResourceFields, useResourceForm } from "./resource-form";

interface NeighborhoodPostPageProps {
  neighborhood: Circle;
  // the Circles inside it the member belongs to, which may post (at least one)
  circles: Circle[];
  // it went up at once (a circle of one), or its proposal is waiting
  onPosted: () => void;
  onProposed: (proposalId: string) => void;
  onDiscard: () => void;
}

/* A post for a neighborhood's bulletin: which of their Circles it's from,
   then the same fields as a circle's bulletin item. It isn't saved but
   proposed, for that circle's consent (the top bar's orange Propose, which
   asks first), and goes up once it's given; a circle of one posts it at
   once. Which Circle it's from is always chosen, from none to start, even
   for someone in only one: it's posted as that circle, and that circle is
   asked. A page on every screen, like the event form, since it starts a
   proposal rather than pinning something up. */
export function NeighborhoodPostPage({ neighborhood, circles, onPosted, onProposed, onDiscard }: NeighborhoodPostPageProps) {
  const { proposeNeighborhoodPost, profile } = useAppState();
  const allCircles = useCircles();
  // always chosen, never assumed, even from one: it's posted as that circle
  const [circleId, setCircleId] = useState("");
  const circle = circles.find((c) => c.id === circleId);
  const alone = circle?.members.length === 1;
  const [confirming, setConfirming] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const form = useResourceForm(circleId, null, () => {}, async (input) => {
    const result = await proposeNeighborhoodPost(circleId, input);
    if (!result.ok) return result;
    if (result.published) onPosted();
    else onProposed(result.proposalId);
    return { ok: true };
  });

  // nothing to post until it's whole: a title, and a valid link or a message
  const ready = !!circle && !form.busy && Object.keys(validateResourceInput({ title: form.title, icon: form.icon, url: form.url, message: form.message })).length === 0;

  const explorer = useFederationExplorer({
    title: "From",
    circles: allCircles,
    value: circleId || null,
    onChange: setCircleId,
    refusal: (c) => (circles.some((x) => x.id === c.id) ? null : `Only a Circle in ${neighborhood.name} you belong to can post`),
    you: { id: profile.id, homeCircleId: profile.homeCircleId },
  });

  useBackHandler(explorer.backHandler ?? (form.dirty && !form.busy ? () => setConfirmingDiscard(true) : null));
  useTopBarAction(
    explorer.topBarAction ?? (alone
      ? { label: form.busy ? "Posting" : "Post", icon: CheckIcon, onAction: () => void form.submit(), disabled: !ready, variant: "primary" }
      : { label: form.busy ? "Proposing" : "Propose post", icon: HandRaisedIcon, onAction: () => setConfirming(true), disabled: !ready, variant: "propose" })
  );

  if (explorer.view) return explorer.view;

  return (
    <PageContainer size="compact">
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <div>
          <Label htmlFor="post-from">From</Label>
          <FederationExplorerField id="post-from" circles={allCircles} value={circleId || null} onOpen={explorer.open} />
          <p className="mt-1.5 font-serif text-sm leading-snug text-soft">It goes on {neighborhood.name}&rsquo;s bulletin, for everyone who lives there, and into their daily digest.</p>
        </div>
        <ResourceFields form={form} audience="neighbors" />
      </form>

      {explorer.dialog}
      {confirming && circle && (
        <ConfirmModal
          title="Propose this post?"
          message={`It's from ${circle.name}, so it needs the consent of its members. It goes up once they've given it.`}
          confirmLabel="Propose post"
          cancelLabel="Not yet"
          tone="flame"
          onConfirm={() => {
            setConfirming(false);
            void form.submit();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
      {confirmingDiscard && (
        <ConfirmModal
          title="Discard this post?"
          message="It hasn't been proposed yet. If you leave now, it'll be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={onDiscard}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
