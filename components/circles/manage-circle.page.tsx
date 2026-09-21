"use client";

import { useRef, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { BackButton, Button, ConfirmModal, Eyebrow, Input, Label, PageContainer, Section, SectionGroup, Select, TextArea } from "@/components/shared";
import { EditableTags } from "@/components/profile/editable-tags";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_ROLE_LABEL_MAX, circleHasRoles, validateCircleRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, Member } from "@/lib/types";

// matches circle.page.tsx's read-only facts grid (label above a bold value,
// evenly split columns) — kept fixed at 4 slots since that's what the
// reference display grid assumes today.
const FACT_SLOTS = 4;

interface FactDraft {
  label: string;
  value: string;
}

interface HourDraft {
  day: string;
  time: string;
}

// one row of the roles table. `key` only keeps React's list stable while rows
// are added and removed; a role is identified by its name.
interface RoleRow {
  key: string;
  label: string;
  builtin: boolean;
  memberId: number | null;
}

interface ManageCirclePageProps {
  circle: Circle;
  circles: Circle[];
  onSave: (patch: Partial<Circle>) => void;
  // roles are saved separately from the page's own fields: the server checks
  // the caller belongs to the circle, and can refuse
  onSaveRoles: (roles: CircleRoleDraft[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

export function ManageCirclePage({ circle: o, circles, onSave, onSaveRoles, onBack }: ManageCirclePageProps) {
  const { profile } = useAppState();
  const memberById = useMemberById();
  const [parentId, setParentId] = useState<string | null>(o.parentId ?? null);
  // neighborhoods first (sorted), then the city root last — only
  // neighborhoods and the root are offered as a parent for now — general
  // reparenting under any circle is future work. The root circle itself has
  // no parent, so the Scope field below is hidden for it.
  const root = circles.find((c) => c.parentId === null);
  const scopeOptions: { id: string; label: string }[] = circles
    .filter((c) => c.type === "neighborhood" && c.id !== o.id)
    .map((c) => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .concat(root && root.id !== o.id ? [{ id: root.id, label: root.name }] : []);
  const [about, setAbout] = useState(o.about);
  const [offers, setOffers] = useState([...o.offers]);
  const [facts, setFacts] = useState<FactDraft[]>(() =>
    Array.from({ length: FACT_SLOTS }, (_, i) => {
      const [label, value] = o.facts[i] || ["", ""];
      return { label, value };
    })
  );
  // blank slots (no label and no value) are dropped rather than saved as
  // empty facts — this also lets a circle end up with fewer than 4 facts,
  // which circle.page.tsx's display grid already handles (it sizes its
  // columns from facts.length rather than assuming 4).
  const factPairs = facts
    .map((f): [string, string] => [f.label.trim(), f.value.trim()])
    .filter(([label, value]) => label || value);
  const [website, setWebsite] = useState(o.website || "");
  const [address, setAddress] = useState(o.address || "");
  const [hours, setHours] = useState<HourDraft[]>(() => (o.hours || []).map(([day, time]) => ({ day, time })));
  // same drop-blank-rows treatment as facts, letting a circle end up with
  // fewer (or zero) hours rows than it started with.
  const hoursPairs = hours
    .map((h): [string, string] => [h.day.trim(), h.time.trim()])
    .filter(([day, time]) => day || time);
  // roles: optional, only for a circle that can have them, and only editable by
  // its own members (the server enforces the latter; this just doesn't offer it)
  const showRoles = circleHasRoles(o) && o.members.includes(profile.id);
  const [roleRows, setRoleRows] = useState<RoleRow[]>(() => (o.roles ?? []).map((r) => ({ key: `${r.builtin ? "b" : "c"}:${r.label}`, ...r })));
  const newRoleKey = useRef(0);
  // a role row left with no name is dropped, like a blank fact or hours row
  const rolePairs: CircleRoleDraft[] = roleRows.map((r) => ({ label: r.label.trim(), memberId: r.memberId })).filter((r) => r.label !== "");
  const savedRolePairs: CircleRoleDraft[] = (o.roles ?? []).map((r) => ({ label: r.label, memberId: r.memberId }));
  const rolesDirty = showRoles && JSON.stringify(rolePairs) !== JSON.stringify(savedRolePairs);
  const [rolesError, setRolesError] = useState("");
  const [saving, setSaving] = useState(false);
  const roleMembers = o.members.map(memberById).filter((m): m is Member => Boolean(m)).sort((a, b) => a.name.localeCompare(b.name));

  const pageDirty =
    parentId !== (o.parentId ?? null) ||
    about !== o.about ||
    offers.join("\u0000") !== o.offers.join("\u0000") ||
    JSON.stringify(factPairs) !== JSON.stringify(o.facts) ||
    website.trim() !== (o.website || "") ||
    address.trim() !== (o.address || "") ||
    JSON.stringify(hoursPairs) !== JSON.stringify(o.hours || []);
  const dirty = pageDirty || rolesDirty;
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function updateFact(i: number, key: keyof FactDraft, value: string) {
    setFacts((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: value } : f)));
  }

  function updateHour(i: number, key: keyof HourDraft, value: string) {
    setHours((prev) => prev.map((h, j) => (j === i ? { ...h, [key]: value } : h)));
  }

  function addHourRow() {
    setHours((prev) => [...prev, { day: "", time: "" }]);
  }

  function removeHourRow(i: number) {
    setHours((prev) => prev.filter((_, j) => j !== i));
  }

  function updateRole(key: string, patch: Partial<RoleRow>) {
    setRoleRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRole() {
    setRoleRows((prev) => [...prev, { key: `n:${newRoleKey.current++}`, label: "", builtin: false, memberId: null }]);
  }

  function removeRole(key: string) {
    setRoleRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSave() {
    if (saving) return;
    setRolesError("");
    if (rolesDirty) {
      // instant feedback only — the server re-validates and is the real check
      const problem = validateCircleRoles(rolePairs, o.members);
      if (problem) return setRolesError(problem);
      setSaving(true);
      const result = await onSaveRoles(rolePairs);
      setSaving(false);
      if (!result.ok) return setRolesError(result.error);
    }
    // only touch the page (and who last edited it) if its own fields changed
    if (pageDirty) {
      onSave({ parentId, about: about.trim(), offers, facts: factPairs, website: website.trim(), address: address.trim(), hours: hoursPairs });
    }
    onBack();
  }

  // shared by the top BackButton and the bottom Cancel button — both leave
  // the form the same way, so both need the same unsaved-changes guard.
  function handleLeave() {
    if (dirty) setConfirmingDiscard(true);
    else onBack();
  }

  return (
    <PageContainer size="normal">
      <BackButton onClick={handleLeave}>{o.name}</BackButton>

      <div className="mt-4 border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5">
        <Eyebrow className="text-soft">Manage circle</Eyebrow>
        <h1 className="mt-3 font-sans text-title font-extrabold tracking-[-0.035em] leading-[0.95]">{o.name}</h1>
        <p className="mt-3 max-w-[42em] font-serif text-sm leading-normal text-soft">
          You’re editing this page as a member. Changes are visible to everyone, and your name will show as the last editor.
        </p>
      </div>

      <SectionGroup>
        {o.parentId !== null && (
          <Section>
            <Label htmlFor="circle-scope">Scope</Label>
            <Select id="circle-scope" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value === "" ? null : e.target.value)} className="max-w-90">
              {scopeOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
            <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
              Choosing a neighborhood places this circle inside it. Choosing {root?.name ?? "the city"} makes it citywide.
            </p>
          </Section>
        )}

        <Section>
          <Label>Quick facts</Label>
          <div className="grid grid-cols-1 min-[720px]:grid-cols-4 border border-ink">
            {facts.map((f, i) => (
              <div
                key={i}
                className={clsx(
                  "p-3.5",
                  i < facts.length - 1 && "border-b min-[720px]:border-b-0 min-[720px]:border-r border-faint",
                )}
              >
                <input
                  value={f.label}
                  onChange={(e) => updateFact(i, "label", e.target.value)}
                  placeholder="Label"
                  className="w-full border border-faint bg-paper px-2 py-1.5 font-sans text-micro font-bold uppercase tracking-[0.15em] text-soft outline-none focus:border-ink"
                />
                <input
                  value={f.value}
                  onChange={(e) => updateFact(i, "value", e.target.value)}
                  placeholder="Value"
                  className="mt-2 w-full border border-faint bg-paper px-2 py-1.5 font-sans text-lg font-extrabold tracking-tight text-ink outline-none focus:border-ink"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <Label>About</Label>
          <TextArea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Write a short description of your organization, its purpose, and what it does."
            rows={5}
          />
        </Section>

        <Section>
          <Label>What we offer</Label>
          <EditableTags values={offers} onChange={setOffers} placeholder="Add an offering and press Enter" />
        </Section>

        {showRoles && (
          <Section>
            <Label>Roles</Label>
            <p className="mb-3 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
              Optional. Pick who fills each role in {o.name}; a member with a role shows it on their card here instead of their occupation. Secretary, Leader and Facilitator are always listed — leave any empty — and you can add your own.
            </p>
            <div className="border border-ink">
              <div className="hidden border-b border-ink px-3.5 py-2 min-[720px]:grid min-[720px]:grid-cols-2 min-[720px]:gap-3.5">
                <Eyebrow className="text-soft">Role</Eyebrow>
                <Eyebrow className="text-soft">Member</Eyebrow>
              </div>
              {roleRows.map((r) => (
                <div key={r.key} className="grid grid-cols-1 gap-2 border-b border-faint px-3.5 py-3 last:border-b-0 min-[720px]:grid-cols-2 min-[720px]:items-center min-[720px]:gap-3.5">
                  {r.builtin ? (
                    <div className="font-sans text-sm font-bold">{r.label}</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        value={r.label}
                        onChange={(e) => updateRole(r.key, { label: e.target.value })}
                        maxLength={CIRCLE_ROLE_LABEL_MAX}
                        placeholder="Role name"
                        aria-label="Role name"
                        className="min-w-0 flex-1 border border-faint bg-paper px-2.5 py-2 font-sans text-sm font-bold outline-none focus:border-ink"
                      />
                      <button
                        onClick={() => removeRole(r.key)}
                        aria-label={`Remove ${r.label || "role"}`}
                        className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-1.5 text-soft hover:text-ink"
                      >
                        <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                  <Select
                    value={r.memberId ?? ""}
                    onChange={(e) => updateRole(r.key, { memberId: e.target.value === "" ? null : Number(e.target.value) })}
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
            <Button variant="secondary" size="compact" onClick={addRole} className="mt-3">
              <PlusIcon className="size-3.5" strokeWidth={2.5} />
              Add role
            </Button>
            {rolesError && <p className="mt-3 font-sans text-sm font-bold text-danger">{rolesError}</p>}
          </Section>
        )}

        <Section>
          <div className="flex flex-col gap-5.5">
            <div>
              <Label>Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="yourorg.coop"
              />
            </div>

            <div>
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Providence, RI"
              />
            </div>

            <div>
              <Label>Open hours</Label>
              <div className="flex flex-col gap-2.5">
                {hours.map((h, i) => (
                  <div key={i} className="flex items-stretch border border-ink">
                    <input
                      value={h.day}
                      onChange={(e) => updateHour(i, "day", e.target.value)}
                      placeholder="Day (e.g. Tue or Mon–Fri)"
                      className="min-w-0 flex-1 border-0 border-r border-ink px-3 py-2.75 font-serif text-base outline-none"
                    />
                    <input
                      value={h.time}
                      onChange={(e) => updateHour(i, "time", e.target.value)}
                      placeholder="Hours (e.g. 4–8pm)"
                      className="min-w-0 flex-1 border-0 border-r border-ink px-3 py-2.75 font-serif text-base outline-none"
                    />
                    <button
                      onClick={() => removeHourRow(i)}
                      aria-label="Remove"
                      className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-paper px-3.5 text-soft"
                    >
                      <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="compact" onClick={addHourRow} className="self-start">
                  <PlusIcon className="size-3.5" strokeWidth={2.5} />
                  Add hours
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </SectionGroup>

      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button variant="secondary" onClick={handleLeave}>Cancel</Button>
      </div>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to this organization. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
