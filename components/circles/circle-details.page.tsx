"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, Input, Label, PageContainer, Select } from "@/components/shared";
import { CIRCLE_TYPE_LABEL, circleTypeNoun } from "@/lib/circles.util";
import { changedFields, checkChanges, checkCircleBasics, hasChanges } from "@/lib/proposals.util";
import type { Circle, CircleProposal, CircleType, ProposalChanges } from "@/lib/types";
import { CircleBasicsFields } from "./circle-basics-fields";
import { ConsentNotice, useConsentError } from "./consent-form";
import { ParentCircleSelect } from "./parent-circle-select";

// neighborhood isn't offered here for now — its type carries real behavior
// (home circles, the folder view, no roles) that switching into or out of
// isn't safe to do from this generic form yet.
// a group's type is fixed, and nothing else can become one (see updateCircle)
// Other is only kept, never chosen: a circle should say what it is, so it's
// offered only to one that's Other already (see typeOptions below)
const CIRCLE_TYPE_OPTIONS = (Object.entries(CIRCLE_TYPE_LABEL) as [CircleType, string][]).filter(
  ([value]) => value !== "neighborhood" && value !== "group" && value !== "other"
);

interface CircleDetailsPageProps {
  circle: Circle;
  circles: Circle[];
  memberId: number;
  // a change already open for consent, which holds these until it's decided
  openProposal?: CircleProposal;
  // these are the members' to decide, by consent: proposed, not saved
  onPropose: (changes: ProposalChanges) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

/* Manage circle → Details: what a circle is (its name, tagline, type and
   parent, and a Circle's domain and aims), which its members decide by
   consent, so Save proposes the changes rather than making them. */
export function CircleDetailsPage({ circle: o, circles, memberId, openProposal, onPropose, onBack }: CircleDetailsPageProps) {
  const [parentId, setParentId] = useState<string | null>(o.parentId ?? null);
  const [type, setType] = useState<CircleType>(o.type);
  const typeOptions = o.type === "other" ? [...CIRCLE_TYPE_OPTIONS, ["other", CIRCLE_TYPE_LABEL.other] as [CircleType, string]] : CIRCLE_TYPE_OPTIONS;
  const [name, setName] = useState(o.name);
  const [tagline, setTagline] = useState(o.tagline);
  // a Circle's domain and aims (only while its type is Circle); one aim row
  // to start with if it has none, since it needs at least one
  const [domain, setDomain] = useState(o.domain ?? "");
  const [aims, setAims] = useState<string[]>(() => (o.aims && o.aims.length > 0 ? [...o.aims] : [""]));
  const isCircleType = type === "circle";
  const { consentError, setConsentError, clearError, fieldError } = useConsentError();
  const locked = !!openProposal;
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // only what actually changes needs consent
  const proposed = changedFields(o, {
    name,
    tagline,
    type,
    ...(o.parentId !== null && parentId !== null ? { parentId } : {}),
    ...(isCircleType ? { domain, aims } : {}),
  });
  const dirty = hasChanges(proposed);

  async function handleSave() {
    if (saving) return;
    setConsentError(null);
    // instant feedback only — the server checks again, and is the real check
    const problem = checkChanges(o, proposed, circles) ?? checkCircleBasics(o, proposed);
    if (problem) return setConsentError(problem);
    setSaving(true);
    const result = await onPropose(proposed);
    setSaving(false);
    if (!result.ok) setConsentError({ field: null, message: result.error });
  }

  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Propose changes", icon: CheckIcon, onAction: handleSave, disabled: !dirty || saving || locked, variant: "primary" });

  return (
    <PageContainer size="normal">
      <ConsentNotice circle={o} openProposal={openProposal} memberId={memberId} error={consentError?.field === null ? consentError.message : null} />
      <div className="flex flex-col gap-5.5">
        {o.parentId !== null && (
          <div id="field-parentId">
            <ParentCircleSelect
              circles={circles}
              value={parentId ?? ""}
              onChange={(id) => {
                clearError("parentId");
                setParentId(id === "" ? null : id);
              }}
              except={o.id}
              disabled={locked}
            />
            {fieldError("parentId")}
          </div>
        )}

        {o.type !== "neighborhood" && o.type !== "group" && (
          <div id="field-type">
            <Label htmlFor="circle-type">Type</Label>
            <Select
              id="circle-type"
              value={type}
              onChange={(e) => {
                clearError("type");
                setType(e.target.value as CircleType);
              }}
              disabled={locked}
              className="min-[720px]:max-w-90"
            >
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            {fieldError("type")}
          </div>
        )}

        <div id="field-name">
          <Label htmlFor="circle-name">Name</Label>
          <Input
            id="circle-name"
            value={name}
            onChange={(e) => {
              clearError("name");
              setName(e.target.value);
            }}
            disabled={locked}
            placeholder={`${circleTypeNoun(type).charAt(0).toUpperCase()}${circleTypeNoun(type).slice(1)} name`}
          />
          {fieldError("name")}
        </div>

        <div id="field-tagline">
          <Label htmlFor="circle-tagline">Tagline</Label>
          <Input
            id="circle-tagline"
            value={tagline}
            onChange={(e) => {
              clearError("tagline");
              setTagline(e.target.value);
            }}
            disabled={locked}
            placeholder="A short line under the name"
          />
          {fieldError("tagline")}
        </div>

        {/* what makes it a circle, in sociocracy's terms */}
        {isCircleType && (
          <CircleBasicsFields
            domain={domain}
            onDomainChange={(v) => {
              clearError("domain");
              setDomain(v);
            }}
            aims={aims}
            onAimsChange={(v) => {
              clearError("aims");
              setAims(v);
            }}
            disabled={locked}
            domainError={fieldError("domain")}
            aimsError={fieldError("aims")}
          />
        )}
      </div>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have changes you haven't proposed. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
