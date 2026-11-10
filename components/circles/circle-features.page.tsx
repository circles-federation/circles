"use client";

import { useState } from "react";
import { HandRaisedIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, PageContainer, SettingRow, SettingRows } from "@/components/shared";
import { GROUP_FEATURES, cleanFeatures } from "@/lib/circles.util";
import { changedFields, checkChanges, hasChanges } from "@/lib/proposals.util";
import type { Circle, CircleProposal, GroupFeature, ProposalChanges } from "@/lib/types";
import { ConsentNotice, useConsentError } from "./consent-form";

interface CircleFeaturesPageProps {
  circle: Circle;
  circles: Circle[];
  memberId: number;
  // a change already open for consent, which holds this until it's decided
  openProposal?: CircleProposal;
  onPropose: (changes: ProposalChanges) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

/* Manage circle → Features (a group's only): which of the features another
   circle has from the start the group has switched on. They all begin off,
   and like Details and Roles a change is proposed for its members' consent,
   so Save is the orange Propose. */
export function CircleFeaturesPage({ circle: o, circles, memberId, openProposal, onPropose, onBack }: CircleFeaturesPageProps) {
  const [features, setFeatures] = useState<GroupFeature[]>(cleanFeatures(o.features ?? []));
  const { consentError, setConsentError, clearError, fieldError } = useConsentError();
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const locked = !!openProposal;
  const proposed = changedFields(o, { features });
  const dirty = hasChanges(proposed);

  async function handleSave() {
    if (saving) return;
    setConsentError(null);
    const problem = checkChanges(o, proposed, circles);
    if (problem) return setConsentError(problem);
    setSaving(true);
    const result = await onPropose(proposed);
    setSaving(false);
    if (!result.ok) setConsentError({ field: null, message: result.error });
  }

  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Propose changes", icon: HandRaisedIcon, onAction: handleSave, disabled: !dirty || saving || locked, variant: "propose" });

  const toggle = (key: GroupFeature, on: boolean) => {
    clearError("features");
    setFeatures((was) => cleanFeatures(on ? [...was, key] : was.filter((k) => k !== key)));
  };

  return (
    <PageContainer size="normal">
      <ConsentNotice circle={o} openProposal={openProposal} memberId={memberId} error={consentError?.field === null ? consentError.message : null} />
      <p className="mb-4 max-w-[36em] font-serif text-base leading-normal text-body">Turning one off hides it without deleting what&rsquo;s in it.</p>
      <SettingRows>
        {GROUP_FEATURES.map((f) => (
          <SettingRow key={f.key} label={f.label} detail={f.description} checked={features.includes(f.key)} onChange={(on) => toggle(f.key, on)} disabled={locked} />
        ))}
      </SettingRows>
      {fieldError("features")}

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
