"use client";

import { useRef, useState } from "react";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Button, ConfirmModal, Eyebrow, Input, Label, PageContainer, Section, SectionGroup, Select, SimpleTabs, TextArea } from "@/components/shared";
import { EditableTags } from "@/components/profile/editable-tags";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_ROLE_LABEL_MAX, builtinRoleDescription, circleHasRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { changedFields, hasChanges, validateChanges } from "@/lib/proposals.util";
import { CIRCLE_TYPE_LABEL, circleHasWiki } from "@/lib/circles.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, CircleProposal, CircleType, Member, ProposalChanges } from "@/lib/types";
import { ParentCircleSelect } from "./parent-circle-select";
import { ProposalBanner } from "./proposal-banner";

// neighborhood isn't offered here for now — its type carries real behavior
// (home circles, the folder view, no roles) that switching into or out of
// isn't safe to do from this generic form yet.
// a group's type is fixed, and nothing else can become one (see updateCircle)
// Other is only kept, never chosen: a circle should say what it is, so it's
// offered only to one that's Other already (see typeOptions below)
const CIRCLE_TYPE_OPTIONS = (Object.entries(CIRCLE_TYPE_LABEL) as [CircleType, string][]).filter(
  ([value]) => value !== "neighborhood" && value !== "group" && value !== "other"
);

// the domain ending its website and email placeholders suggest: .coop for a
// co-op, .org for a collective or circle, .com for anything else
function domainEnding(type: CircleType): string {
  if (type === "cooperative") return "coop";
  if (type === "collective" || type === "circle") return "org";
  return "com";
}

// what to call it in a placeholder: its type, or "organization" for Other
function typeNoun(type: CircleType): string {
  return type === "other" ? "organization" : CIRCLE_TYPE_LABEL[type].toLowerCase();
}

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
  // a proposal already open for this circle, which holds its consent fields
  // until it's decided
  openProposal?: CircleProposal;
  // the page's own fields, edited freely
  onSave: (patch: Partial<Circle>) => void;
  // its name, tagline, type, parent and roles, which its members decide by
  // consent: proposed, not saved (the route goes on to the proposal)
  onPropose: (changes: ProposalChanges) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBack: () => void;
}

export function ManageCirclePage({ circle: o, circles, openProposal, onSave, onPropose, onBack }: ManageCirclePageProps) {
  const { profile } = useAppState();
  const memberById = useMemberById();
  const [parentId, setParentId] = useState<string | null>(o.parentId ?? null);
  // the root circle itself has no parent, so the Parent Circle field below
  // (ParentCircleSelect) is hidden for it
  const [type, setType] = useState<CircleType>(o.type);
  const typeOptions = o.type === "other" ? [...CIRCLE_TYPE_OPTIONS, ["other", CIRCLE_TYPE_LABEL.other] as [CircleType, string]] : CIRCLE_TYPE_OPTIONS;
  const [name, setName] = useState(o.name);
  const [tagline, setTagline] = useState(o.tagline);
  const [about, setAbout] = useState(o.about);
  const [offers, setOffers] = useState([...o.offers]);
  const [needs, setNeeds] = useState([...o.needs]);
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
  const [consentError, setConsentError] = useState("");
  // locked while a proposal is open: one at a time, so two can't change the same thing
  const locked = !!openProposal;
  const [saving, setSaving] = useState(false);
  const roleMembers = o.members.map(memberById).filter((m): m is Member => Boolean(m)).sort((a, b) => a.name.localeCompare(b.name));

  // what would need the members' consent: only what actually changes
  const proposed = changedFields(o, {
    name,
    tagline,
    type,
    ...(o.parentId !== null && parentId !== null ? { parentId } : {}),
    ...(showRoles ? { roles: rolePairs } : {}),
  });
  const proposing = hasChanges(proposed);
  // the rest of the page, saved directly
  const freeDirty =
    about !== o.about ||
    offers.join("\u0000") !== o.offers.join("\u0000") ||
    needs.join("\u0000") !== o.needs.join("\u0000") ||
    JSON.stringify(factPairs) !== JSON.stringify(o.facts) ||
    join.trim() !== (o.join || "") ||
    contact.trim() !== (o.contact || "") ||
    website.trim() !== (o.website || "") ||
    address.trim() !== (o.address || "") ||
    JSON.stringify(hoursPairs) !== JSON.stringify(o.hours || []);
  const dirty = freeDirty || proposing;
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // a group has no wiki or quick facts (see circleHasWiki), so only the Circle part
  const hasWiki = circleHasWiki(o);
  const [activeTab, setActiveTab] = useState<"wiki" | "circle">(hasWiki ? "wiki" : "circle");

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
    setConsentError("");
    if (proposing) {
      // instant feedback only — the server checks again, and is the real check
      const problem = validateChanges(o, proposed, circles);
      if (problem) {
        setActiveTab("circle");
        return setConsentError(problem);
      }
    }
    // the rest of the page (and who last edited it), only if any of it changed
    if (freeDirty) {
      onSave({ about: about.trim(), offers, needs, facts: factPairs, join: join.trim(), contact: contact.trim(), website: website.trim(), address: address.trim(), hours: hoursPairs });
    }
    if (proposing) {
      setSaving(true);
      const result = await onPropose(proposed);
      setSaving(false);
      if (!result.ok) {
        setActiveTab("circle");
        setConsentError(result.error);
      }
      return;
    }
    onBack();
  }

  // leaving is the top bar's Back, which asks before discarding changes
  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({
    label: saving ? "Saving" : proposing ? "Propose changes" : "Save",
    icon: CheckIcon,
    onAction: handleSave,
    disabled: !dirty || saving,
    variant: "primary",
  });

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
      </div>

      {/* right under the masthead, whose bottom rule is its top, and above the
          tabs, as on the circle's own page */}
      {hasWiki && <div className="grid grid-cols-1 min-[720px]:grid-cols-4 border-b border-ink">
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
      </div>}

      {hasWiki && (
        <SimpleTabs
          className="mt-6"
          tabs={[{ key: "wiki", label: "Wiki" }, { key: "circle", label: "Circle" }]}
          active={activeTab}
          onChange={(key) => setActiveTab(key as "wiki" | "circle")}
        />
      )}

      {activeTab === "wiki" && (
        <SectionGroup>
          <Section>
            <Label>About</Label>
            <TextArea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder={`Write a short description of your ${typeNoun(type)}, its purpose, and what it does.`}
              rows={5}
            />
          </Section>

          <Section>
            <Label>What we offer</Label>
            <EditableTags values={offers} onChange={setOffers} placeholder="Add an offering and press Enter" />
          </Section>

          <Section>
            <Label>What we need</Label>
            <EditableTags values={needs} onChange={setNeeds} placeholder="Add a need and press Enter" />
          </Section>

          <Section>
            <div className="flex flex-col gap-5.5">
              <div>
                <Label>Website</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder={`yourorg.${domainEnding(type)}`}
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
                  placeholder={`How does someone become part of this ${typeNoun(type)}?`}
                  rows={3}
                />
              </div>

              <div>
                <Label>Get in touch</Label>
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={`hello@yourorg.${domainEnding(type)}`}
                />
              </div>
            </div>
          </Section>
        </SectionGroup>
      )}

      {activeTab === "circle" && (
        <SectionGroup>
          <Section>
            {/* these fields are the members' to decide, by consent */}
            {openProposal ? (
              <div className="mb-5.5">
                <ProposalBanner proposal={openProposal} memberId={profile.id} />
                <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
                  These can be changed again once it&rsquo;s decided.
                </p>
              </div>
            ) : (
              <p className="mb-5.5 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
                Changes here need {o.name}&rsquo;s consent: saving proposes them to its members.
              </p>
            )}
            <div className="flex flex-col gap-5.5">
              {o.parentId !== null && (
                <ParentCircleSelect circles={circles} value={parentId ?? ""} onChange={(id) => setParentId(id === "" ? null : id)} except={o.id} disabled={locked} />
              )}

              {o.type !== "neighborhood" && o.type !== "group" && (
                <div>
                  <Label htmlFor="circle-type">Type</Label>
                  <Select id="circle-type" value={type} onChange={(e) => setType(e.target.value as CircleType)} disabled={locked} className="min-[720px]:max-w-90">
                    {typeOptions.map(([value, label]) => (
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
                  disabled={locked}
                  placeholder={`${typeNoun(type).charAt(0).toUpperCase()}${typeNoun(type).slice(1)} name`}
                />
              </div>

              <div>
                <Label>Tagline</Label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  disabled={locked}
                  placeholder="A short line under the name"
                />
              </div>
            </div>
          </Section>

          {showRoles && (
            <Section>
              <Label>Roles</Label>
              <p className="mb-3 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
                Optional. A Secretary, Leader or Facilitator can approve meetings and events without a vote.
              </p>
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
                          className="min-w-0 flex-1 border border-faint bg-paper px-2.5 py-2 font-sans text-sm font-bold outline-none focus:border-ink touch:text-base"
                        />
                        <button
                          onClick={() => removeRole(r.key)}
                          disabled={locked}
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
              <Button variant="secondary" size="compact" onClick={addRole} disabled={locked} className="mt-3">
                <PlusIcon className="size-3.5" strokeWidth={2.5} />
                Add role
              </Button>
            </Section>
          )}
          {consentError && (
            <Section>
              <p className="font-sans text-sm font-bold text-danger">{consentError}</p>
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
