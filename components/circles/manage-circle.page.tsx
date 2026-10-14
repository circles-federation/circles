"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightStartOnRectangleIcon, CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Button, ConfirmModal, Eyebrow, Input, Label, PageContainer, Section, SectionGroup, Select, SimpleTabs, TextArea } from "@/components/shared";
import { EditableTags } from "@/components/profile/editable-tags";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_ROLE_LABEL_MAX, builtinRoleDescription, circleHasRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { changedFields, checkChanges, checkCircleBasics, hasChanges, type ConsentField } from "@/lib/proposals.util";
import { CIRCLE_TYPE_LABEL, circleHasWiki } from "@/lib/circles.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, CircleProposal, CircleType, Member, ProposalChanges } from "@/lib/types";
import { CircleBasicsFields } from "./circle-basics-fields";
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
  // leave the circle (the route goes on from it once it's done)
  onLeave: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function ManageCirclePage({ circle: o, circles, openProposal, onSave, onPropose, onBack, onLeave }: ManageCirclePageProps) {
  const { profile } = useAppState();
  const memberById = useMemberById();
  const [parentId, setParentId] = useState<string | null>(o.parentId ?? null);
  // the root circle itself has no parent, so the Parent Circle field below
  // (ParentCircleSelect) is hidden for it
  const [type, setType] = useState<CircleType>(o.type);
  const typeOptions = o.type === "other" ? [...CIRCLE_TYPE_OPTIONS, ["other", CIRCLE_TYPE_LABEL.other] as [CircleType, string]] : CIRCLE_TYPE_OPTIONS;
  const [name, setName] = useState(o.name);
  const [tagline, setTagline] = useState(o.tagline);
  // a Circle's domain and aims (only while its type is Circle); one aim row
  // to start with if it has none, since it needs at least one
  const [domain, setDomain] = useState(o.domain ?? "");
  const [aims, setAims] = useState<string[]>(() => (o.aims && o.aims.length > 0 ? [...o.aims] : [""]));
  const isCircleType = type === "circle";
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
  // a problem with what's proposed: shown under its field (or, from the
  // server, which doesn't say which, at the top of the Circle tab), scrolled
  // to, and cleared as soon as that field's edited
  const [consentError, setConsentError] = useState<{ field: ConsentField | null; message: string } | null>(null);
  const clearError = (field: ConsentField) => setConsentError((e) => (e && (e.field === field || e.field === null) ? null : e));
  useEffect(() => {
    if (!consentError) return;
    const el = document.getElementById(consentError.field ? `field-${consentError.field}` : "circle-tab-top");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus({ preventScroll: true });
  }, [consentError]);
  const fieldError = (field: ConsentField) =>
    consentError?.field === field && <p className="mt-2 font-sans text-sm font-bold text-danger">{consentError.message}</p>;
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
    ...(isCircleType ? { domain, aims } : {}),
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
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  // what leaving means for them: what they lose, the roles they'd leave
  // empty, and, for the last member, that it's archived
  const myRoles = (o.roles ?? []).filter((r) => r.memberId === profile.id).map((r) => r.label);
  const leaveMessage = [
    "You'll no longer see its bulletin or the events shown only to its members.",
    myRoles.length > 0 &&
      `You're its ${myRoles.length > 1 ? `${myRoles.slice(0, -1).join(", ")} and ${myRoles[myRoles.length - 1]}` : myRoles[0]}; ${myRoles.length > 1 ? "those roles" : "that role"} will be left empty.`,
    o.members.length <= 1 && "You're its last member, so it will be archived and hidden from everyone.",
  ]
    .filter(Boolean)
    .join(" ");
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
    if (proposing) {
      // instant feedback only — the server checks again, and is the real check
      const problem = checkChanges(o, proposed, circles) ?? checkCircleBasics(o, proposed);
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
        setConsentError({ field: null, message: result.error });
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

      {hasWiki && (
        <SimpleTabs
          className="mt-6"
          tabs={[{ key: "wiki", label: "Wiki" }, { key: "circle", label: "Circle" }]}
          active={activeTab}
          onChange={(key) => setActiveTab(key as "wiki" | "circle")}
        />
      )}

      {activeTab === "wiki" && (
        <>
          {/* the quick facts open the wiki, as they do on the circle's page:
              before the sections rather than one of them, since the box ends on
              its own ink rule and needs no hairline after it */}
          <div className="pt-8">
            <Label>Quick facts</Label>
            <div className="grid grid-cols-1 border border-ink min-[720px]:grid-cols-4">
              {facts.map((f, i) => (
                <div
                  key={i}
                  className={clsx("p-3.5", i < facts.length - 1 && "border-b border-faint min-[720px]:border-r min-[720px]:border-b-0")}
                >
                  <input
                    value={f.label}
                    onChange={(e) => updateFact(i, "label", e.target.value)}
                    placeholder="Label"
                    aria-label={`Fact ${i + 1} label`}
                    className="w-full border border-faint bg-paper px-2 py-1.5 font-sans text-micro font-bold uppercase tracking-[0.15em] text-soft outline-none focus:border-ink touch:text-base touch:tracking-[0.06em]"
                  />
                  <input
                    value={f.value}
                    onChange={(e) => updateFact(i, "value", e.target.value)}
                    placeholder="Value"
                    aria-label={`Fact ${i + 1} value`}
                    className="mt-2 w-full border border-faint bg-paper px-2 py-1.5 font-sans text-lg font-extrabold tracking-tight text-ink outline-none focus:border-ink"
                  />
                </div>
              ))}
            </div>
          </div>

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
        </>
      )}

      {activeTab === "circle" && (
        <SectionGroup>
          <Section id="circle-tab-top">
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
            {consentError?.field === null && <p className="mb-5.5 font-sans text-sm font-bold text-danger">{consentError.message}</p>}
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
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    clearError("name");
                    setName(e.target.value);
                  }}
                  disabled={locked}
                  placeholder={`${typeNoun(type).charAt(0).toUpperCase()}${typeNoun(type).slice(1)} name`}
                />
                {fieldError("name")}
              </div>

              <div id="field-tagline">
                <Label>Tagline</Label>
                <Input
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
          </Section>

          {showRoles && (
            <Section id="field-roles">
              <Label>Roles</Label>
              <p className="mb-3 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
                Optional. Anyone holding a role can schedule the circle&apos;s meetings without asking for its consent.
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
              {fieldError("roles")}
            </Section>
          )}
        </SectionGroup>
      )}

      {/* leaving: one-way, so at the foot, apart from the rest, and asked
          about first */}
      <div className="mt-10 border-t border-faint pt-8">
        <Button variant="danger" onClick={() => setConfirmingLeave(true)} disabled={leaving}>
          <ArrowRightStartOnRectangleIcon className="size-3.5" strokeWidth={2.5} />
          Leave {o.name}
        </Button>
        {leaveError && <p className="mt-3 font-sans text-sm font-bold text-danger">{leaveError}</p>}
      </div>

      {confirmingLeave && (
        <ConfirmModal
          title={`Leave ${o.name}?`}
          message={leaveMessage}
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={async () => {
            setConfirmingLeave(false);
            setLeaving(true);
            setLeaveError(null);
            const result = await onLeave();
            if (!result.ok) {
              setLeaveError(result.error);
              setLeaving(false);
            }
          }}
          onCancel={() => setConfirmingLeave(false)}
        />
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
