"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { BuildingStorefrontIcon, CheckIcon, HandRaisedIcon, LockClosedIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, Input, Label, PageContainer, RichSelect, RingIcon, Section, SectionGroup } from "@/components/shared";
import {
  CIRCLE_NAME_MAX,
  CIRCLE_TAGLINE_MAX,
  CIRCLE_TYPE_DESCRIPTION,
  CIRCLE_TYPE_LABEL,
  CREATABLE_CIRCLE_TYPES,
  indexCircles,
  parentCircleOptions,
  validateNewCircle,
  type NewCircleInput,
} from "@/lib/circles.util";
import { newCircleNeighborhood } from "@/lib/proposals.util";
import type { Circle, CircleType } from "@/lib/types";
import { CircleBasicsFields } from "./circle-basics-fields";
import { ParentCircleSelect } from "./parent-circle-select";

// each kind's icon in the Type list: a ring for a Circle, as on every chip
const CIRCLE_TYPE_ICON: Partial<Record<CircleType, ComponentType<SVGProps<SVGSVGElement>>>> = {
  circle: RingIcon,
  collective: UserGroupIcon,
  cooperative: BuildingStorefrontIcon,
  group: LockClosedIcon,
};

interface CreateCirclePageProps {
  circles: Circle[];
  // where Create was pressed: the neighborhood it was pressed in, or the city
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
   top bar's orange Propose, which asks first. */
export function CreateCirclePage({ circles, initialParentId, onCreate, onBack }: CreateCirclePageProps) {
  const parents = parentCircleOptions(circles);
  const root = circles.find((c) => c.parentId === null);
  const startingParent = parents.find((c) => c.id === initialParentId)?.id ?? root?.id ?? "";
  // no type to start with: what kind of circle it is is a choice to make, not a default
  const [type, setType] = useState<CircleType | "">("");
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

  const input: NewCircleInput | null = type ? { type, name, tagline, parentId, ...(type === "circle" ? { domain, aims } : {}) } : null;
  // the neighborhood whose consent it needs, if it does
  const neighborhood = input ? newCircleNeighborhood(input, indexCircles(circles)) : null;
  const problem = input ? validateNewCircle(input, circles) : "Choose what kind of circle this is.";
  const dirty = type !== "" || name !== "" || tagline !== "" || parentId !== startingParent || domain !== "" || aims.some((a) => a !== "");

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

  useBackHandler(dirty && !creating ? () => setConfirmingDiscard(true) : null);
  useTopBarAction(
    neighborhood
      ? { label: creating ? "Proposing" : "Propose circle", icon: HandRaisedIcon, onAction: () => setConfirmingProposal(true), disabled: !!problem || creating, variant: "propose" }
      : { label: creating ? "Creating" : "Create circle", icon: CheckIcon, onAction: create, disabled: !!problem || creating, variant: "primary" }
  );

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (New circle) is the page's only heading */}
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
          <ParentCircleSelect circles={circles} value={parentId} onChange={setParentId} />
        </Section>
      </SectionGroup>

      <p className="mt-2 font-serif text-sm leading-normal text-soft">
        You&rsquo;ll be its first member. Add more about it, like what it does and how to join, from Manage circle once it&rsquo;s {neighborhood ? "started" : "created"}.
      </p>
      {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}

      {confirmingProposal && neighborhood && (
        <ConfirmModal
          title="Propose this circle?"
          message={`A Circle can post to ${neighborhood.name}'s bulletin, so it needs the consent of everyone who lives there. They're asked in their daily digest.`}
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
