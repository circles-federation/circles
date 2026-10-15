"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { HandRaisedIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Button, ConfirmModal, DISABLED_FIELD, Eyebrow, PageContainer, Select } from "@/components/shared";
import { CIRCLE_ROLE_LABEL_MAX, builtinRoleDescription, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { changedFields, checkChanges, hasChanges } from "@/lib/proposals.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, CircleProposal, Member, ProposalChanges } from "@/lib/types";
import { ConsentNotice, useConsentError } from "./consent-form";

// one row of the roles table. `key` only keeps React's list stable while rows
// are added and removed; a role is identified by its name.
interface RoleRow {
  key: string;
  label: string;
  builtin: boolean;
  memberId: number | null;
}

interface CircleRolesPageProps {
  circle: Circle;
  circles: Circle[];
  memberId: number;
  // a change already open for consent, which holds these until it's decided
  openProposal?: CircleProposal;
  // who holds which role is the members' to decide, by consent
  onPropose: (changes: ProposalChanges) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

/* Manage circle → Roles: who holds the built-in roles and the circle's own,
   one member picker per role, plus adding, renaming and removing its own.
   Like Details, a change is proposed for the members' consent. */
export function CircleRolesPage({ circle: o, circles, memberId, openProposal, onPropose, onBack }: CircleRolesPageProps) {
  const memberById = useMemberById();
  const [roleRows, setRoleRows] = useState<RoleRow[]>(() => (o.roles ?? []).map((r) => ({ key: `${r.builtin ? "b" : "c"}:${r.label}`, ...r })));
  const newRoleKey = useRef(0);
  // a role row left with no name is dropped, like a blank fact or hours row
  const rolePairs: CircleRoleDraft[] = roleRows.map((r) => ({ label: r.label.trim(), memberId: r.memberId })).filter((r) => r.label !== "");
  const roleMembers = o.members.map(memberById).filter((m): m is Member => Boolean(m)).sort((a, b) => a.name.localeCompare(b.name));
  const { consentError, setConsentError, clearError, fieldError } = useConsentError();
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const proposed = changedFields(o, { roles: rolePairs });
  const dirty = hasChanges(proposed);
  const locked = !!openProposal;

  function updateRole(key: string, patch: Partial<RoleRow>) {
    clearError("roles");
    setRoleRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRole() {
    clearError("roles");
    setRoleRows((prev) => [...prev, { key: `n:${newRoleKey.current++}`, label: "", builtin: false, memberId: null }]);
  }

  function removeRole(key: string) {
    clearError("roles");
    setRoleRows((prev) => prev.filter((r) => r.key !== key));
  }

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

      <p className="mb-3 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
        Optional. Anyone holding a role can schedule the circle&apos;s meetings without asking for its consent.
      </p>
      <div id="field-roles">
        <div className="border border-ink">
          <div className="hidden border-b border-ink px-3.5 py-2 min-[720px]:grid min-[720px]:grid-cols-2 min-[720px]:gap-3.5">
            <Eyebrow className="text-soft">Role</Eyebrow>
            <Eyebrow className="text-soft">Member</Eyebrow>
          </div>
          {roleRows.map((r) => (
            <div key={r.key} className="grid grid-cols-1 gap-2 border-b border-faint px-3.5 py-3 last:border-b-0 min-[720px]:grid-cols-2 min-[720px]:items-start min-[720px]:gap-3.5">
              {r.builtin ? (
                <div>
                  <div className="font-sans text-sm font-bold">{r.label}</div>
                  {builtinRoleDescription(r.label) && (
                    <p className="mt-1 font-serif text-sm leading-snug text-soft">{builtinRoleDescription(r.label)}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={r.label}
                    onChange={(e) => updateRole(r.key, { label: e.target.value })}
                    disabled={locked}
                    maxLength={CIRCLE_ROLE_LABEL_MAX}
                    placeholder="Role name"
                    aria-label="Role name"
                    className={clsx("min-w-0 flex-1 border border-faint bg-paper px-2.5 py-2 font-sans text-sm font-bold outline-none focus:border-ink touch:text-base", DISABLED_FIELD)}
                  />
                  {!locked && (
                  <button
                    onClick={() => removeRole(r.key)}
                    aria-label={`Remove ${r.label || "role"}`}
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-1.5 text-soft hover:text-ink"
                  >
                    <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                  </button>
                  )}
                </div>
              )}
              <Select
                value={r.memberId ?? ""}
                onChange={(e) => updateRole(r.key, { memberId: e.target.value === "" ? null : Number(e.target.value) })}
                disabled={locked}
                aria-label={`Member for ${r.label || "new role"}`}
                className="w-full"
              >
                <option value="">Unassigned</option>
                {roleMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>
        {!locked && (
          <Button variant="secondary" size="compact" onClick={addRole} className="mt-3">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            Add role
          </Button>
        )}
        {fieldError("roles")}
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
