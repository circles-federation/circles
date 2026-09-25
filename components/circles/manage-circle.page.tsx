"use client";

import { useRef, useState } from "react";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Button, ConfirmModal, Eyebrow, Input, Label, PageContainer, Section, SectionGroup, Select, SimpleTabs, TextArea } from "@/components/shared";
import { EditableTags } from "@/components/profile/editable-tags";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_ROLE_LABEL_MAX, circleHasRoles, validateCircleRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { CIRCLE_TYPE_LABEL } from "@/lib/circles.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, CircleType, Member } from "@/lib/types";

// neighborhood isn't offered here for now — its type carries real behavior
// (home circles, the folder view, no roles) that switching into or out of
// isn't safe to do from this generic form yet.
const CIRCLE_TYPE_OPTIONS = (Object.entries(CIRCLE_TYPE_LABEL) as [CircleType, string][]).filter(
  ([value]) => value !== "neighborhood"
);

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
  // no parent, so the Parent Circle field below is hidden for it.
  const root = circles.find((c) => c.parentId === null);
  const parentOptions: { id: string; label: string }[] = circles
    .filter((c) => c.type === "neighborhood" && c.id !== o.id)
    .map((c) => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .concat(root && root.id !== o.id ? [{ id: root.id, label: root.name }] : []);
  const [type, setType] = useState<CircleType>(o.type);
  const [name, setName] = useState(o.name);
  const [tagline, setTagline] = useState(o.tagline);
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
  const [join, setJoin] = useState(o.join || "");
  const [contact, setContact] = useState(o.contact || "");
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
    type !== o.type ||
    name.trim() !== o.name ||
    tagline.trim() !== o.tagline ||
    about !== o.about ||
    offers.join("\u0000") !== o.offers.join("\u0000") ||
    JSON.stringify(factPairs) !== JSON.stringify(o.facts) ||
    join.trim() !== (o.join || "") ||
    contact.trim() !== (o.contact || "") ||
    website.trim() !== (o.website || "") ||
    address.trim() !== (o.address || "") ||
    JSON.stringify(hoursPairs) !== JSON.stringify(o.hours || []);
  const dirty = pageDirty || rolesDirty;
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [activeTab, setActiveTab] = useState<"wiki" | "circle">("wiki");

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
      if (problem) {
        setActiveTab("circle");
        return setRolesError(problem);
      }
      setSaving(true);
      const result = await onSaveRoles(rolePairs);
      setSaving(false);
      if (!result.ok) {
        setActiveTab("circle");
        return setRolesError(result.error);
      }
    }
    // only touch the page (and who last edited it) if its own fields changed
    if (pageDirty) {
      onSave({ parentId, type, name: name.trim(), tagline: tagline.trim(), about: about.trim(), offers, facts: factPairs, join: join.trim(), contact: contact.trim(), website: website.trim(), address: address.trim(), hours: hoursPairs });
    }
    onBack();
  }

  // the top bar's Back and the bottom Cancel button both leave the form, so
  // both get the same unsaved-changes guard
  useBackHandler(dirty ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Save", icon: CheckIcon, onAction: handleSave, disabled: !dirty || saving, variant: "primary" });
  function handleLeave() {
    if (dirty) setConfirmingDiscard(true);
    else onBack();
  }

  return (
    <PageContainer size="normal">
      <div className="flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="min-w-0 flex-1">
          <Eyebrow className="text-soft">Manage circle</Eyebrow>
          <h1 className="mt-3 font-sans text-title font-extrabold tracking-[-0.035em] leading-[0.95]">{o.name}</h1>
          <p className="mt-3 max-w-[42em] font-serif text-sm leading-normal text-soft">
            You’re editing this page as a member. Changes are visible to everyone, and your name will show as the last editor.
          </p>
        </div>
        {/* desktop only: on mobile, Save is the top bar's check (see the
            useTopBarAction call above) */}
        <div className="hidden min-[720px]:block min-[720px]:self-start">
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <SimpleTabs
        className="mt-6"
        tabs={[{ key: "wiki", label: "Wiki" }, { key: "circle", label: "Circle" }]}
        active={activeTab}
        onChange={(key) => setActiveTab(key as "wiki" | "circle")}
      />

      {activeTab === "wiki" && (
        <SectionGroup>
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
                    className="w-full border border-faint bg-paper px-2 py-1.5 font-sans text-micro font-bold uppercase tracking-[0.15em] text-soft outline-none focus:border-ink touch:text-base touch:tracking-[0.06em]"
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

          <Section>
            <div className="flex flex-col gap-5.5">
              <div>
                <Label>How to join</Label>
                <TextArea
                  value={join}
                  onChange={(e) => setJoin(e.target.value)}
                  placeholder="How does someone become part of this organization?"
                  rows={3}
                />
              </div>

              <div>
                <Label>Get in touch</Label>
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="hello@yourorg.coop"
                />
              </div>
            </div>
          </Section>
        </SectionGroup>
      )}

      {activeTab === "circle" && (
        <SectionGroup>
          <Section>
            <div className="flex flex-col gap-5.5">
              {o.parentId !== null && (
                <div>
                  <Label htmlFor="circle-parent">Parent Circle</Label>
                  <Select id="circle-parent" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value === "" ? null : e.target.value)} className="min-[720px]:max-w-90">
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </Select>
                  <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
                    Choosing a neighborhood places this circle inside it. Choosing {root?.name ?? "the city"} makes it citywide.
                  </p>
                </div>
              )}

              {o.type !== "neighborhood" && (
                <div>
                  <Label htmlFor="circle-type">Type</Label>
                  <Select id="circle-type" value={type} onChange={(e) => setType(e.target.value as CircleType)} className="min-[720px]:max-w-90">
                    {CIRCLE_TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Organization name"
                />
              </div>

              <div>
                <Label>Tagline</Label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="A short line under the name"
                />
              </div>
            </div>
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
                          className="min-w-0 flex-1 border border-faint bg-paper px-2.5 py-2 font-sans text-sm font-bold outline-none focus:border-ink touch:text-base"
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
        </SectionGroup>
      )}

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
