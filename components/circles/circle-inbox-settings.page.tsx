"use client";

import { useState } from "react";
import { HandRaisedIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, Label, PageContainer, Switch } from "@/components/shared";
import { changedFields, checkChanges, hasChanges } from "@/lib/proposals.util";
import type { Circle, CircleProposal, ProposalChanges } from "@/lib/types";
import { ConsentNotice, useConsentError } from "./consent-form";

interface CircleInboxSettingsPageProps {
  circle: Circle;
  circles: Circle[];
  memberId: number;
  // a change already open for consent, which holds this until it's decided
  openProposal?: CircleProposal;
  // whether it has an Inbox is the members' to decide, by consent
  onPropose: (changes: ProposalChanges) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

/* Manage circle → Inbox: whether anyone on Circles may write to the circle
   (see Circle Inbox), one switch. Like Details and Roles, a change is
   proposed for the members' consent, so its Save is the orange Propose. */
export function CircleInboxSettingsPage({ circle: o, circles, memberId, openProposal, onPropose, onBack }: CircleInboxSettingsPageProps) {
  const [inbox, setInbox] = useState(!!o.inbox);
  const { consentError, setConsentError, clearError, fieldError } = useConsentError();
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const locked = !!openProposal;
  const proposed = changedFields(o, { inbox });
  const dirty = hasChanges(proposed);

  async function handleSave() {
    if (saving) return;
    setConsentError(null);
    // instant feedback only — the server checks again, and is the real check
    const problem = checkChanges(o, proposed, circles);
    if (problem) return setConsentError(problem);
    setSaving(true);
    const result = await onPropose(proposed);
    setSaving(false);
    if (!result.ok) setConsentError({ field: null, message: result.error });
  }

  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Propose changes", icon: HandRaisedIcon, onAction: handleSave, disabled: !dirty || saving || locked, variant: "propose" });

  return (
    <PageContainer size="normal">
      <ConsentNotice circle={o} openProposal={openProposal} memberId={memberId} error={consentError?.field === null ? consentError.message : null} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label id="circle-inbox-label">Inbox</Label>
          <p className="mt-1 max-w-[36em] font-serif text-base leading-normal text-body">
            Anyone on Circles can write to {o.name} from its Wiki. Its members read what&rsquo;s written in an Inbox tab, take it to handle, and answer by email.
          </p>
        </div>
        <Switch
          checked={inbox}
          onChange={(on) => {
            clearError("inbox");
            setInbox(on);
          }}
          labelledBy="circle-inbox-label"
          disabled={locked}
        />
      </div>
      {fieldError("inbox")}

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
