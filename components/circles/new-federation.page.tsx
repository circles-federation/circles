"use client";

import { useMemo, useState } from "react";
import { HandRaisedIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { BOXED_LIST, Button, CircleTypeIcon, ConfirmModal, GhostIconButton, Input, Label, PageContainer, RichSelect, useFederationExplorer } from "@/components/shared";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { CIRCLE_NAME_MAX, CIRCLE_TAGLINE_MAX, indexCircles } from "@/lib/circles.util";
import { MAX_FEDERATION_CIRCLES, checkNewFederation, defaultFederationParent, federationRefusal, type NewFederationInput } from "@/lib/federation.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, Member } from "@/lib/types";
import { ParentCircleSelect, useParentCircleExplorer } from "./parent-circle-select";

interface NewFederationPageProps {
  // the circle proposing it, which the member is in and which decides first
  circle: Circle;
  circles: Circle[];
  onPropose: (input: NewFederationInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

/* Manage circle → Federate: a collective or co-op proposes a federation with
   others: its name, who joins, where it sits (the neighborhood they share to
   start with, else the city) and this circle's delegate to it. The top bar's
   orange Propose asks first; Back asks before discarding. */
export function NewFederationPage({ circle: o, circles, onPropose, onBack }: NewFederationPageProps) {
  const { profile } = useAppState();
  const memberById = useMemberById();
  const byId = useMemo(() => indexCircles(circles), [circles]);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [joinIds, setJoinIds] = useState<string[]>([]);
  // follows the circles chosen until the proposer chooses a place themself
  const [chosenParent, setChosenParent] = useState<string | null>(null);
  const [delegateId, setDelegateId] = useState<number | null>(null);
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [confirmingProposal, setConfirmingProposal] = useState(false);

  const parentId = chosenParent ?? defaultFederationParent([o.id, ...joinIds], byId)?.id ?? "";
  const members = o.members.map(memberById).filter((m): m is Member => !!m);
  const input: NewFederationInput = { name, tagline, parentId, circleId: o.id, joinIds, ...(delegateId !== null ? { delegateId } : {}) };
  const problem = checkNewFederation(input, profile.id, circles);
  const dirty = name !== "" || tagline !== "" || joinIds.length > 0 || chosenParent !== null || delegateId !== null;

  async function propose() {
    if (problem || proposing) return;
    setProposing(true);
    setError(null);
    const result = await onPropose(input);
    if (!result.ok) {
      setError(result.error);
      setProposing(false);
    }
  }

  const joinExplorer = useFederationExplorer({
    title: "Add a circle",
    circles,
    value: null,
    onChange: (id) => setJoinIds((ids) => [...ids, id]),
    refusal: (c) => (c.id === o.id ? "Your circle" : joinIds.includes(c.id) ? "Already added" : federationRefusal(c, byId)),
    you: { id: profile.id, homeCircleId: profile.homeCircleId },
  });
  // choosing a circle or its place: on a phone, a view in place of the form,
  // which then owns the top bar's action and Back
  const parentExplorer = useParentCircleExplorer({ circles, value: parentId, onChange: setChosenParent });
  useBackHandler(joinExplorer.backHandler ?? parentExplorer.backHandler ?? (dirty && !proposing ? () => setConfirmingDiscard(true) : null));
  useTopBarAction(
    joinExplorer.topBarAction ??
      parentExplorer.topBarAction ?? {
        label: proposing ? "Proposing" : "Propose federation",
        icon: HandRaisedIcon,
        onAction: () => setConfirmingProposal(true),
        disabled: !!problem || proposing,
        variant: "propose",
      }
  );

  if (joinExplorer.view) return joinExplorer.view;
  if (parentExplorer.view) return parentExplorer.view;

  return (
    <PageContainer size="normal">
      <div className="flex flex-col gap-6">
        <p className="max-w-[42em] font-serif text-base leading-normal text-body">
          A federation is a circle above {o.name} and the others, decided by one delegate from each. Each circle consents to joining.
        </p>
        <div>
          <Label htmlFor="federation-name">Name</Label>
          <Input id="federation-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={CIRCLE_NAME_MAX} placeholder="What it's called" />
        </div>
        <div>
          <Label htmlFor="federation-tagline">Tagline</Label>
          <Input id="federation-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={CIRCLE_TAGLINE_MAX} placeholder="A short line under the name (optional)" />
        </div>
        <div>
          <Label>Circles</Label>
          <ul className={BOXED_LIST}>
            {[o.id, ...joinIds].map((id) => {
              const c = byId[id];
              if (!c) return null;
              return (
                <li key={id} className="flex min-h-14 items-center gap-3 border-b border-ink py-2 last:border-b-0">
                  <CircleTypeIcon circle={c} className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-base font-bold">{c.name}</span>
                    <span className="block truncate font-sans text-sm text-soft">{id === o.id ? "Yours, consents first" : (byId[c.parentId ?? ""]?.name ?? "")}</span>
                  </span>
                  {id !== o.id && (
                    <GhostIconButton icon={XMarkIcon} label={`Remove ${c.name}`} onClick={() => setJoinIds((ids) => ids.filter((x) => x !== id))} />
                  )}
                </li>
              );
            })}
          </ul>
          {joinIds.length + 1 < MAX_FEDERATION_CIRCLES && (
            <Button variant="secondary" size="compact" onClick={joinExplorer.open} className="mt-3">
              <PlusIcon className="size-4" strokeWidth={2.5} />
              Add circle
            </Button>
          )}
        </div>
        <ParentCircleSelect
          circles={circles}
          value={parentId}
          onOpen={parentExplorer.open}
          label="Where it sits"
          help="The neighborhood or city the federation goes in. Its circles move inside it."
        />
        <div className="min-[720px]:max-w-120">
          <Label htmlFor="federation-delegate">{o.name}&rsquo;s delegate</Label>
          <RichSelect
            id="federation-delegate"
            label="Its delegate"
            placeholder="Choose a member"
            value={delegateId !== null ? String(delegateId) : null}
            onChange={(v) => setDelegateId(Number(v))}
            options={members.map((m) => ({ value: String(m.id), label: m.name, badges: rolesHeldBy(o, m.id) }))}
          />
          <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">Speaks for {o.name} in the federation.</p>
        </div>
      </div>
      {error && <p className="mt-4 font-sans text-sm font-bold text-danger">{error}</p>}

      {joinExplorer.dialog}
      {parentExplorer.dialog}

      {confirmingProposal && (
        <ConfirmModal
          title="Propose this federation?"
          message={`${o.name}'s members are asked first. Once they consent, the other circles are.`}
          confirmLabel="Propose federation"
          cancelLabel="Not yet"
          tone="flame"
          onConfirm={() => {
            setConfirmingProposal(false);
            void propose();
          }}
          onCancel={() => setConfirmingProposal(false)}
        />
      )}
      {confirmingDiscard && (
        <ConfirmModal
          title="Discard this federation?"
          message="It hasn't been proposed yet. If you leave now, what you've entered will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
