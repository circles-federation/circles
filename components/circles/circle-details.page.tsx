"use client";

import { useState } from "react";
import { HandRaisedIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, Input, Label, PageContainer, Select, SettingRow, SettingRows } from "@/components/shared";
import { CIRCLE_TYPE_LABEL, circleTypeNoun, indexCircles, isGroup, startedInside } from "@/lib/circles.util";
import { changedFields, checkChanges, checkCircleBasics, hasChanges, neighborhoodConsentFor } from "@/lib/proposals.util";
import type { Circle, CircleProposal, CircleType, ProposalChanges } from "@/lib/types";
import { CircleBasicsFields } from "./circle-basics-fields";
import { ConsentNotice, useConsentError } from "./consent-form";
import { ParentCircleSelect, useParentCircleExplorer } from "./parent-circle-select";

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
   consent, so Save proposes the changes rather than making them. Becoming a
   Circle in a neighborhood, or a Circle moving into one, is its residents'
   to decide too, so that asks first, saying so. */
export function CircleDetailsPage({ circle: o, circles, memberId, openProposal, onPropose, onBack }: CircleDetailsPageProps) {
  const [parentId, setParentId] = useState<string | null>(o.parentId ?? null);
  const [type, setType] = useState<CircleType>(o.type);
  const typeOptions = o.type === "other" ? [...CIRCLE_TYPE_OPTIONS, ["other", CIRCLE_TYPE_LABEL.other] as [CircleType, string]] : CIRCLE_TYPE_OPTIONS;
  const [name, setName] = useState(o.name);
  const [tagline, setTagline] = useState(o.tagline);
  // a group's visibility: private unless its members make it public
  const [isPublic, setPublic] = useState(!!o.public);
  // a Circle's domain and aims (only while its type is Circle); one aim row
  // to start with if it has none, since it needs at least one
  const [domain, setDomain] = useState(o.domain ?? "");
  const [aims, setAims] = useState<string[]>(() => (o.aims && o.aims.length > 0 ? [...o.aims] : [""]));
  const isCircleType = type === "circle";
  // started inside a circle: it stays there, and stays a Circle, sending its delegate up
  const inside = startedInside(o, indexCircles(circles));
  const { consentError, setConsentError, clearError, fieldError } = useConsentError();
  const locked = !!openProposal;
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [confirmingNeighborhood, setConfirmingNeighborhood] = useState(false);

  // only what actually changes needs consent
  const proposed = changedFields(o, {
    name,
    tagline,
    type,
    ...(o.parentId !== null && parentId !== null ? { parentId } : {}),
    ...(isCircleType ? { domain, aims } : {}),
    ...(isGroup(o) ? { public: isPublic } : {}),
  });
  const dirty = hasChanges(proposed);
  // the neighborhood that would decide this with the circle's members, if any
  const neighborhood = neighborhoodConsentFor(o, proposed, indexCircles(circles));

  // instant feedback only — the server checks again, and is the real check
  // a Circle's domain and aims as the form has them, changed or not: a
  // Circle that hasn't defined itself yet is asked to here, whatever's proposed
  function check(): boolean {
    setConsentError(null);
    const problem = checkChanges(o, proposed, circles) ?? (isCircleType ? checkCircleBasics(o, { ...proposed, domain, aims: aims.map((a) => a.trim()).filter(Boolean) }) : null);
    if (problem) setConsentError(problem);
    return !problem;
  }

  async function handleSave() {
    if (saving || !check()) return;
    setSaving(true);
    const result = await onPropose(proposed);
    setSaving(false);
    if (!result.ok) setConsentError({ field: null, message: result.error });
  }

  // choosing its parent: on a phone, a view in place of the form, which then
  // owns the top bar's action and Back
  const parentExplorer = useParentCircleExplorer({
    circles,
    value: parentId ?? "",
    onChange: (id) => {
      clearError("parentId");
      setParentId(id);
    },
    except: o.id,
  });
  useBackHandler(parentExplorer.backHandler ?? (dirty && !saving ? () => setConfirmingDiscard(true) : null));
  useTopBarAction(
    parentExplorer.topBarAction ?? {
      label: saving ? "Saving" : "Propose changes",
      icon: HandRaisedIcon,
      onAction: neighborhood ? () => check() && setConfirmingNeighborhood(true) : handleSave,
      disabled: !dirty || saving || locked,
      variant: "propose",
    }
  );

  if (parentExplorer.view) return parentExplorer.view;

  return (
    <PageContainer size="normal">
      <ConsentNotice circle={o} openProposal={openProposal} memberId={memberId} error={consentError?.field === null ? consentError.message : null} />
      <div className="flex flex-col gap-6">
        {inside ? (
          <div>
            <Label>Parent Circle</Label>
            <p className="font-serif text-base text-body">
              Inside {inside.name}, which started it. It stays there, as a Circle, so it can send a delegate.
            </p>
          </div>
        ) : o.parentId !== null && (
          <div id="field-parentId">
            <ParentCircleSelect
              circles={circles}
              value={parentId ?? ""}
              onOpen={parentExplorer.open}
              disabled={locked}
            />
            {fieldError("parentId")}
          </div>
        )}

        {!inside && o.type !== "neighborhood" && o.type !== "group" && (
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

        {isGroup(o) && (
          <div id="field-public">
            <Label>Visibility</Label>
            <SettingRows>
              <SettingRow
                label="Public"
                detail="Anyone on Circles can find and open it."
                checked={isPublic}
                onChange={(on) => {
                  clearError("public");
                  setPublic(on);
                }}
                disabled={locked}
              />
            </SettingRows>
            {fieldError("public")}
          </div>
        )}

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

      {parentExplorer.dialog}

      {confirmingNeighborhood && neighborhood && (
        <ConfirmModal
          title="Propose these changes?"
          message={`A Circle in ${neighborhood.name} can post to its bulletin, so everyone who lives there decides this with ${o.name}'s members. They're asked in their daily digest.`}
          confirmLabel="Propose changes"
          cancelLabel="Not yet"
          tone="flame"
          onConfirm={() => {
            setConfirmingNeighborhood(false);
            void handleSave();
          }}
          onCancel={() => setConfirmingNeighborhood(false)}
        />
      )}

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
