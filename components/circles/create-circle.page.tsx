"use client";

import { useState } from "react";
import { CheckIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { CIRCLE_TYPE_ICON, ConfirmModal, Input, Label, PageContainer, RichSelect, Section, SectionGroup } from "@/components/shared";
import {
  CIRCLE_NAME_MAX,
  CIRCLE_TAGLINE_MAX,
  CIRCLE_TYPE_DESCRIPTION,
  CIRCLE_TYPE_LABEL,
  CREATABLE_CIRCLE_TYPES,
  circleCanHaveCircles,
  indexCircles,
  parentCircleOptions,
  validateNewCircle,
  type NewCircleInput,
} from "@/lib/circles.util";
import { useMemberById } from "@/lib/hooks";
import { newCircleDecider } from "@/lib/proposals.util";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import type { Circle, CircleType, Member } from "@/lib/types";
import { CircleBasicsFields } from "./circle-basics-fields";
import { ParentCircleSelect, useParentCircleExplorer } from "./parent-circle-select";

interface CreateCirclePageProps {
  circles: Circle[];
  // where Create was pressed: the neighborhood it was pressed in, a circle
  // that can have circles of its own, or the city
  initialParentId?: string;
  onCreate: (input: NewCircleInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

/* A new circle: what kind it is, its name and tagline, where it sits, and,
   for a Circle, its domain and aims — the rest of its page is filled in from
   Manage circle once it exists. The parent starts as wherever Create was
   pressed (a neighborhood's page, or the Circles root for the city), and can
   be changed. Created by the top bar's check, disabled until every required
   field has a value; Back asks before discarding. A Circle in a neighborhood
   can post to its bulletin, so it's proposed to the neighborhood instead: the
   top bar's orange Propose, which asks first. Pressed in a circle that can
   have circles (circleCanHaveCircles), it's one of that circle's: a Circle,
   always there, with a delegate chosen from its members as its first member,
   and proposed to that circle's members. */
export function CreateCirclePage({ circles, initialParentId, onCreate, onBack }: CreateCirclePageProps) {
  const parents = parentCircleOptions(circles);
  const root = circles.find((c) => c.parentId === null);
  // started inside a circle: its place and kind are settled, and it needs a delegate
  const inside = circles.find((c) => c.id === initialParentId && circleCanHaveCircles(c));
  const startingParent = inside?.id ?? parents.find((c) => c.id === initialParentId)?.id ?? root?.id ?? "";
  const memberById = useMemberById();
  const insideMembers = (inside?.members ?? []).map(memberById).filter((m): m is Member => !!m);
  const [delegateId, setDelegateId] = useState<number | null>(null);
  // no type to start with: what kind of circle it is is a choice to make, not a
  // default, except inside a circle, where it's a Circle
  const [type, setType] = useState<CircleType | "">(inside ? "circle" : "");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [parentId, setParentId] = useState(startingParent);
  // a Circle's domain and aims, asked for only while the type is Circle
  const [domain, setDomain] = useState("");
  const [aims, setAims] = useState<string[]>([""]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [confirmingProposal, setConfirmingProposal] = useState(false);

  const input: NewCircleInput | null = type
    ? { type, name, tagline, parentId, ...(type === "circle" ? { domain, aims } : {}), ...(inside && delegateId !== null ? { delegateId } : {}) }
    : null;
  // whose consent it needs, if anyone's: the circle it's inside, or its neighborhood
  const decider = input ? newCircleDecider(input, indexCircles(circles)) : null;
  const problem = input ? validateNewCircle(input, circles) : "Choose what kind of circle this is.";
  const dirty = (!inside && type !== "") || name !== "" || tagline !== "" || parentId !== startingParent || domain !== "" || aims.some((a) => a !== "") || delegateId !== null;
  const delegateName = delegateId !== null ? memberById(delegateId)?.name : undefined;

  async function create() {
    if (!input || problem || creating) return;
    setCreating(true);
    setError(null);
    const result = await onCreate(input);
    if (!result.ok) {
      setError(result.error);
      setCreating(false);
    }
  }

  // choosing its parent: on a phone, a view in place of the form, which then
  // owns the top bar's action and Back
  const parentExplorer = useParentCircleExplorer({ circles, value: parentId, onChange: setParentId });
  useBackHandler(parentExplorer.backHandler ?? (dirty && !creating ? () => setConfirmingDiscard(true) : null));
  useTopBarAction(
    parentExplorer.topBarAction ?? (decider
      ? { label: creating ? "Proposing" : "Propose circle", icon: HandRaisedIcon, onAction: () => setConfirmingProposal(true), disabled: !!problem || creating, variant: "propose" }
      : { label: creating ? "Creating" : "Create circle", icon: CheckIcon, onAction: create, disabled: !!problem || creating, variant: "primary" })
  );

  if (parentExplorer.view) return parentExplorer.view;

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (New circle) is the page's only heading */}
        {inside ? (
          <Section className="pt-0">
            <p className="font-serif text-base leading-normal text-body">
              One of {inside.name}&rsquo;s circles: a Circle of its own that decides its own work, sending a delegate to decide with {inside.name}&rsquo;s members. {inside.name}&rsquo;s members consent to it starting.
            </p>
          </Section>
        ) : (
        <Section className="pt-0">
          <Label htmlFor="circle-type">Type</Label>
          <div className="min-[720px]:max-w-120">
            <RichSelect
              id="circle-type"
              label="What kind of circle?"
              placeholder="Choose a kind of circle"
              value={type || null}
              onChange={setType}
              options={CREATABLE_CIRCLE_TYPES.map((t) => ({ value: t, label: CIRCLE_TYPE_LABEL[t], hint: CIRCLE_TYPE_DESCRIPTION[t] ?? "", icon: CIRCLE_TYPE_ICON[t] }))}
            />
          </div>
        </Section>
        )}

        <Section>
          <div className="flex flex-col gap-6">
            <div>
              <Label htmlFor="circle-name">Name</Label>
              <Input id="circle-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={CIRCLE_NAME_MAX} placeholder="What it's called" />
            </div>
            <div>
              <Label htmlFor="circle-tagline">Tagline</Label>
              <Input
                id="circle-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={CIRCLE_TAGLINE_MAX}
                placeholder="A short line under the name (optional)"
              />
            </div>
            {/* what makes it a circle, in sociocracy's terms: a Circle needs both */}
            {type === "circle" && (
              <CircleBasicsFields domain={domain} onDomainChange={setDomain} aims={aims} onAimsChange={setAims} />
            )}
          </div>
        </Section>

        <Section>
          {inside ? (
            <div className="min-[720px]:max-w-120">
              <Label htmlFor="circle-delegate">Delegate</Label>
              <RichSelect
                id="circle-delegate"
                label="Its delegate"
                placeholder={`Choose one of ${inside.name}'s members`}
                value={delegateId !== null ? String(delegateId) : null}
                onChange={(v) => setDelegateId(Number(v))}
                options={insideMembers.map((m) => ({ value: String(m.id), label: m.name, badges: rolesHeldBy(inside, m.id) }))}
              />
              <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
                Its first member, who speaks for it in {inside.name} and decides alongside its members. Once it&rsquo;s started, its own members choose its delegate.
              </p>
            </div>
          ) : (
            <ParentCircleSelect circles={circles} value={parentId} onOpen={parentExplorer.open} />
          )}
        </Section>
      </SectionGroup>

      <p className="mt-2 font-serif text-sm leading-normal text-soft">
        {inside ? `${delegateName ?? "Its delegate"} will be its first member` : "You'll be its first member"}. Add more about it, like what it does and how to join, from Manage circle once it&rsquo;s {decider ? "started" : "created"}.
      </p>
      {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}

      {parentExplorer.dialog}

      {confirmingProposal && decider && (
        <ConfirmModal
          title="Propose this circle?"
          message={
            decider.by === "parent"
              ? `It's one of ${decider.circle.name}'s circles, so it needs the consent of ${decider.circle.name}'s members. They're asked straight away.`
              : `A Circle can post to ${decider.circle.name}'s bulletin, so it needs the consent of everyone who lives there. They're asked in their daily digest.`
          }
          confirmLabel="Propose circle"
          cancelLabel="Not yet"
          tone="flame"
          onConfirm={() => {
            setConfirmingProposal(false);
            void create();
          }}
          onCancel={() => setConfirmingProposal(false)}
        />
      )}

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard this circle?"
          message="It hasn't been created yet. If you leave now, what you've entered will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
