"use client";

import { useState } from "react";
import { CheckIcon, HandRaisedIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, Input, Label, PageContainer, Section, SectionGroup, Select } from "@/components/shared";
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
  // no type to start with: choosing one is the point of the info box
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
          <Select id="circle-type" value={type} onChange={(e) => setType(e.target.value as CircleType)} className="min-[720px]:max-w-90">
            <option value="" disabled>
              Choose a kind of circle
            </option>
            {CREATABLE_CIRCLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CIRCLE_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <TypeInfo chosen={type} />
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

/* What each kind of circle is, beside the Type field: every kind, with the
   one chosen picked out, so they can be compared before choosing. */
function TypeInfo({ chosen }: { chosen: CircleType | "" }) {
  return (
    <div className="mt-4 border border-ink border-l-4 px-5 py-4">
      <div className="flex items-center gap-2">
        <InformationCircleIcon className="size-5 shrink-0" strokeWidth={2} />
        <span className="font-sans text-sm font-extrabold tracking-[0.02em]">What kind of circle?</span>
      </div>
      <p className="mt-1.5 font-serif text-sm leading-relaxed text-body">
        Every kind but a group has a public page, can host events and hold meetings, and can give its members roles like Leader.
      </p>
      <dl className="mt-3 flex flex-col gap-3">
        {CREATABLE_CIRCLE_TYPES.map((t) => (
          <div key={t} className={clsx("border-l-2 pl-3", t === chosen ? "border-ink" : "border-transparent")}>
            <dt className={clsx("font-sans text-sm font-extrabold", t === chosen || chosen === "" ? "text-ink" : "text-soft")}>{CIRCLE_TYPE_LABEL[t]}</dt>
            <dd className={clsx("mt-0.5 font-serif text-sm leading-snug", t === chosen || chosen === "" ? "text-body" : "text-soft")}>
              {CIRCLE_TYPE_DESCRIPTION[t]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
