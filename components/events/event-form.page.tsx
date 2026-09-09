"use client";

import { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, BackButton, Button, ConfirmModal, Eyebrow, Input, Label, PageContainer, Select, TabbedPanel, TextArea } from "@/components/shared";
import { EVENT_KINDS, MEMBERS, ORGS_BY_MEMBER } from "@/lib/data";
import { orgDisplayName, orgMembers, orgsForMember, orgScope } from "@/lib/orgs.util";
import type { Event, EventKindKey, Host, Org, Profile, Role } from "@/lib/types";

const DEFAULT_START = "18:00";
const DEFAULT_END = "20:00";

interface SlotDraft {
  label: string;
  description: string;
  min: string;
  max: string;
}

const DEFAULT_SLOTS: SlotDraft[] = [{ label: "", description: "", min: "1", max: "" }];

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `border-t-${accent}`.
const ACCENT: Record<"ink" | "flame", { borderT: string; border: string; text: string }> = {
  ink: { borderT: "border-t-ink", border: "border-ink", text: "text-ink" },
  flame: { borderT: "border-t-flame", border: "border-flame", text: "text-flame" },
};

interface EventFormPageBaseProps {
  profile: Profile;
  orgs: Org[];
  onCancel: () => void;
}

interface CreateEventFormPageProps extends EventFormPageBaseProps {
  mode: "create";
  onCreate: (ev: Event) => void;
}

interface EditEventFormPageProps extends EventFormPageBaseProps {
  mode: "edit";
  event: Event;
  onSave: (patch: Partial<Event>) => void;
}

type EventFormPageProps = CreateEventFormPageProps | EditEventFormPageProps;

/* Shared by /events/new (mode "create") and /events/[id]/edit (mode "edit")
   — the same form either way, just seeded from blank defaults or from the
   event being edited. Editing can't change the event's kind (ordinary vs
   meeting): the tab for whichever kind the event ISN'T gets disabled rather
   than removed, so the tab bar's shape stays identical between the two
   modes. */
export function EventFormPage(props: EventFormPageProps) {
  const { profile, orgs, onCancel, mode } = props;
  const event = mode === "edit" ? props.event : null;

  // host options: the current user, plus every org they belong to
  const myOrgs: Org[] = ORGS_BY_MEMBER[profile.id] || [];
  const hostOptions: { key: string; label: string; host: Host }[] = [
    { key: "member:" + profile.id, label: `${profile.name} (you)`, host: { type: "member", id: profile.id } },
    ...myOrgs.map((o) => ({ key: "org:" + o.id, label: o.name, host: { type: "org" as const, id: o.id } })),
  ];

  // circles eligible to propose a meeting for: any org the proposer belongs
  // to (via orgsForMember, so this includes their home Neighborhood Council
  // and any of its sub-orgs, unlike hostOptions above, which only sees
  // literal membership) — except a city-wide org (orgScope null), since
  // citywide meetings aren't supported yet. The home council sorts first
  // as the most likely default.
  const orgsById = orgs.reduce<Record<string, Org>>((acc, o) => { acc[o.id] = o; return acc; }, {});
  const homeCouncil = orgs.find((o) => o.neighborhood === profile.neighborhood);
  const eligibleCircles: Org[] = [
    ...(homeCouncil ? [homeCouncil] : []),
    ...orgsForMember(profile.id, orgs, MEMBERS).filter((o) => o.id !== homeCouncil?.id && orgScope(o, orgsById) !== null),
  ];
  // labels precomputed here, not inline in JSX — calling orgDisplayName
  // directly inside a JSX expression trips the react-hooks/purity rule's
  // reachability analysis for this component (it stops being able to prove
  // submit()'s Date.now() call is confined to an event handler).
  const circleOptions = eligibleCircles.map((o) => ({ id: o.id, label: orgDisplayName(o) }));

  // the form's starting values — blank defaults for a new event, or the
  // event's own current values when editing. `dirty` (below) diffs live
  // state against these, not hardcoded blanks, so opening the edit form
  // doesn't itself count as a change.
  const initialValues = event
    ? {
        type: (event.kind === "meeting" ? "meeting" : "ordinary") as EventKindKey,
        title: event.title,
        hostKey: event.host.type === "member" ? "member:" + event.host.id : "org:" + event.host.id,
        circleId: event.orgId || eligibleCircles[0]?.id || "",
        date: event.date,
        start: event.start,
        end: event.end,
        location: event.location,
        description: event.description,
        membersOnly: !!event.membersOnly,
        useSlots: Array.isArray(event.roles) && event.roles.length > 0,
        slots: event.roles && event.roles.length > 0
          ? event.roles.map((r): SlotDraft => ({ label: r.label, description: r.description || "", min: String(r.min), max: r.max != null ? String(r.max) : "" }))
          : DEFAULT_SLOTS,
      }
    : {
        type: "ordinary" as EventKindKey,
        title: "",
        hostKey: hostOptions[0]!.key,
        circleId: eligibleCircles[0]?.id || "",
        date: "",
        start: DEFAULT_START,
        end: DEFAULT_END,
        location: "",
        description: "",
        membersOnly: false,
        useSlots: false,
        slots: DEFAULT_SLOTS,
      };

  const [type, setType] = useState<EventKindKey>(initialValues.type);
  const [title, setTitle] = useState(initialValues.title);
  const [hostKey, setHostKey] = useState(initialValues.hostKey);
  const [circleId, setCircleId] = useState(initialValues.circleId);
  const circle = orgsById[circleId] || null;
  const circleName = circle ? orgDisplayName(circle) : "";
  const meetingThresholdPreview = circle ? Math.floor(orgMembers(circle, MEMBERS).length / 2) + 1 : 0;
  const [date, setDate] = useState(initialValues.date);
  const [start, setStart] = useState(initialValues.start);
  const [end, setEnd] = useState(initialValues.end);
  const [location, setLocation] = useState(initialValues.location);
  const [description, setDescription] = useState(initialValues.description);
  const [membersOnly, setMembersOnly] = useState(initialValues.membersOnly);
  // slots (roles) for org-hosted events: each { label, description, min, max }
  const [useSlots, setUseSlots] = useState(initialValues.useSlots);
  const [slots, setSlots] = useState<SlotDraft[]>(initialValues.slots);
  const [error, setError] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // true once something differs from where the form started — guards Back/
  // Cancel behind a confirmation. Switching the Event/Meeting tab alone
  // doesn't count: it's a selection, not entered content (moot in edit mode
  // anyway, since that tab is disabled there).
  const dirty =
    title.trim() !== initialValues.title.trim() ||
    hostKey !== initialValues.hostKey ||
    circleId !== initialValues.circleId ||
    date !== initialValues.date ||
    start !== initialValues.start ||
    end !== initialValues.end ||
    location.trim() !== initialValues.location.trim() ||
    description.trim() !== initialValues.description.trim() ||
    membersOnly !== initialValues.membersOnly ||
    useSlots !== initialValues.useSlots ||
    JSON.stringify(slots) !== JSON.stringify(initialValues.slots);

  // shared by the top BackButton and the bottom Cancel button — both leave
  // the form the same way, so both need the same unsaved-changes guard.
  function handleLeave() {
    if (dirty) setConfirmingDiscard(true);
    else onCancel();
  }

  const meta = EVENT_KINDS[type];
  const gov = meta.governance;
  const accentKey = gov ? "flame" : "ink";
  const accent = ACCENT[accentKey];

  function submit() {
    if (!title.trim()) return setError("Give the " + (gov ? "meeting" : "event") + " a title.");
    if (!date) return setError("Pick a date.");
    if (!location.trim()) return setError("Add a location.");

    if (gov) {
      // governance meetings are proposed by a person, not an org; the
      // proposer is the first vote. A meeting is hosted by whichever
      // circle the proposer chose (see circle/eligibleCircles above).
      if (mode === "edit") {
        props.onSave({
          title: title.trim(),
          orgId: circle ? circle.id : undefined,
          date, start, end,
          location: location.trim(),
          description: description.trim() || "No agenda yet.",
        });
      } else {
        props.onCreate({
          id: "e" + Date.now(),
          title: title.trim(),
          kind: type,
          orgId: circle ? circle.id : undefined,
          host: { type: "member", id: profile.id },
          date, start, end,
          location: location.trim(),
          description: description.trim() || "No agenda yet.",
          votes: [profile.id],
          rsvps: [profile.id],
        });
      }
      return;
    }
    // hostKey is always initialized from hostOptions[0].key (or the event's
    // own host, in edit mode) and only ever set to another hostOptions
    // entry's key, so a match always exists.
    const chosen = hostOptions.find((h) => h.key === hostKey)!;
    const isOrgHost = chosen.host.type === "org";

    // build slots (roles) if this is an org-hosted event using slots
    let roles: Role[] | null = null;
    if (isOrgHost && useSlots) {
      const cleaned = slots.filter((s) => s.label.trim());
      if (cleaned.length === 0) return setError("Add at least one slot, or turn off slots.");
      for (const s of cleaned) {
        const min = parseInt(s.min, 10) || 0;
        const max = s.max === "" ? null : parseInt(s.max, 10);
        if (max != null && max < Math.max(min, 1)) return setError(`"${s.label.trim()}": max can't be less than the minimum.`);
      }
      roles = cleaned.map((s, i) => {
        const min = parseInt(s.min, 10) || 0;
        const max = s.max === "" ? null : parseInt(s.max, 10);
        return {
          key: s.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("slot-" + i),
          label: s.label.trim(),
          description: s.description.trim(),
          min,
          members: [],
          ...(max != null ? { max } : {}),
        };
      });
    }

    if (mode === "edit") {
      // explicit false/undefined here (not omitted), unlike the create
      // branch below — a patch has to actively clear membersOnly/roles if
      // the user turned them off, since omitting the key would just leave
      // whatever the event already had.
      props.onSave({
        title: title.trim(),
        host: chosen.host,
        date, start, end,
        location: location.trim(),
        description: description.trim() || "No description yet.",
        roles: roles || undefined,
        membersOnly: isOrgHost && membersOnly,
      });
    } else {
      props.onCreate({
        id: "e" + Date.now(),
        title: title.trim(),
        kind: "ordinary",
        host: chosen.host,
        date, start, end,
        location: location.trim(),
        description: description.trim() || "No description yet.",
        rsvps: roles ? [] : [profile.id],
        ...(roles ? { roles } : {}),
        ...(isOrgHost && membersOnly ? { membersOnly: true } : {}),
      });
    }
  }

  const types: [EventKindKey, string][] = [
    ["ordinary", "Event"],
    ["meeting", "Meeting"],
  ];

  return (
    <PageContainer size="compact">
      <BackButton onClick={handleLeave}>{mode === "edit" ? initialValues.title : "All events"}</BackButton>

      <div className={clsx("mt-4 border-t-[3px] border-b border-b-ink pt-4 pb-5", accent.borderT)}>
        <Eyebrow className={gov ? "text-flame" : "text-soft"}>{mode === "edit" ? "Edit" : (gov ? "Propose" : "Create")}</Eyebrow>
        <h1 className="mt-3 font-sans text-title font-extrabold tracking-[-0.035em] leading-[0.95]">
          {mode === "edit" ? initialValues.title : (type === "ordinary" ? "New event" : "New meeting")}
        </h1>
      </div>

      {/* type selector — reusable tabbed panel wrapping the form fields.
          In edit mode the kind can't change, so whichever tab doesn't match
          the event's own kind is disabled rather than removed, keeping the
          same two-tab shape as the create form. */}
      <TabbedPanel
        tabs={types.map(([key, label]) => ({
          key, label,
          variant: EVENT_KINDS[key].governance ? "flame" as const : "ink" as const,
          disabled: mode === "edit" && key !== initialValues.type,
        }))}
        active={type}
        onChange={(key) => { setType(key as EventKindKey); setError(""); }}
        className="mt-6"
      >
      {gov && circle && (
        <p className="mb-1 border-l-[3px] border-flame pl-3 font-serif text-sm leading-normal text-[#222]">
          This is a governance meeting for <strong>{circleName}</strong>. Once proposed it needs <strong>{meetingThresholdPreview} votes from {circle.neighborhood ? "residents" : "members"}</strong> to be confirmed. Your proposal counts as the first vote.
        </p>
      )}

      <div className={clsx("flex flex-col gap-5.5", gov && "pt-5.5")}>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={gov ? "What is this meeting about?" : "What's happening?"} />
        </div>

        {!gov && (
          <div>
            <Label htmlFor="host">Hosted by</Label>
            <Select id="host" value={hostKey} onChange={(e) => setHostKey(e.target.value)}>
              {hostOptions.map((h) => (
                <option key={h.key} value={h.key}>{h.label}</option>
              ))}
            </Select>
            {hostKey.startsWith("org:") && (
              <label className={clsx("mt-3.5 flex cursor-pointer items-start gap-2.5 border px-3.5 py-3", membersOnly ? "border-plum bg-plum/6" : "border-faint bg-paper")}>
                <input
                  type="checkbox"
                  checked={membersOnly}
                  onChange={(e) => setMembersOnly(e.target.checked)}
                  className="mt-px size-4.5 shrink-0 cursor-pointer accent-plum"
                />
                <span>
                  <span className={clsx("font-sans text-sm font-bold", membersOnly ? "text-plum" : "text-ink")}>Members only</span>
                  <span className="mt-0.75 block font-serif text-sm leading-[1.45] text-soft">
                    Everyone can see this event, but only members of {hostOptions.find((h) => h.key === hostKey)!.label} can RSVP and are emailed about it.
                  </span>
                </span>
              </label>
            )}
            {hostKey.startsWith("org:") && (
              <div className={clsx("mt-3.5 border px-4 py-3.5", useSlots ? "border-ink" : "border-faint")}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={useSlots}
                    onChange={(e) => setUseSlots(e.target.checked)}
                    className="mt-px size-4.5 shrink-0 cursor-pointer accent-ink"
                  />
                  <span>
                    <span className="font-sans text-sm font-bold">Use slots</span>
                    <span className="mt-0.75 block font-serif text-sm leading-[1.45] text-soft">
                      Define named roles people sign up for (like shift lead, greeter). Slots replace the normal RSVP.
                    </span>
                  </span>
                </label>

                {useSlots && (
                  <div className="mt-4 flex flex-col gap-3.5">
                    {slots.map((s, i) => (
                      <div key={i} className="border border-faint px-3.5 pt-3.5 pb-4">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="font-sans text-eyebrow font-bold tracking-[0.08em] text-soft uppercase">Slot {i + 1}</span>
                          {slots.length > 1 && (
                            <button
                              onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                              className="inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-sans text-eyebrow font-bold tracking-[0.06em] text-soft uppercase"
                            >
                              <XMarkIcon className="size-3" strokeWidth={3} />
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <Input
                            value={s.label}
                            onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                            placeholder="Slot name (e.g. Shift lead)"
                          />
                          <Input
                            value={s.description}
                            onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                            placeholder="Description (optional)"
                          />
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <Label htmlFor={`slot-min-${i}`}>Min</Label>
                              <Input
                                id={`slot-min-${i}`}
                                type="number" min="0"
                                value={s.min}
                                onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, min: e.target.value } : x))}
                              />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={`slot-max-${i}`}>Max (optional)</Label>
                              <Input
                                id={`slot-max-${i}`}
                                type="number" min="1"
                                value={s.max}
                                onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, max: e.target.value } : x))}
                                placeholder="No limit"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      size="compact"
                      onClick={() => setSlots([...slots, { label: "", description: "", min: "1", max: "" }])}
                      className="self-start"
                    >
                      <PlusIcon className="size-3.5" strokeWidth={2.5} />
                      Add slot
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {gov && (
          <div>
            <Label htmlFor="circle">Propose for</Label>
            <Select id="circle" value={circleId} onChange={(e) => setCircleId(e.target.value)}>
              {circleOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
          </div>
        )}
        {gov && (
          <div>
            <Label>Proposed by</Label>
            <div className="flex items-center gap-2.5 border border-ink bg-paper px-3 py-2.75">
              <Avatar member={profile} size={26} />
              <span className="font-sans text-sm font-bold">{profile.name} (you)</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 min-[720px]:grid-cols-3">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3.5 min-[720px]:col-span-2">
            <div>
              <Label htmlFor="start">Start</Label>
              <Input id="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="end">End</Label>
              <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where should people go?" />
        </div>

        <div>
          <Label htmlFor="description">{gov ? "Agenda" : "Description"}</Label>
          <TextArea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder={gov ? "What should this meeting decide or discuss?" : "What's it about, what to bring, who it's for…"} />
        </div>

        {error && (
          <div className={clsx("border-l-[3px] pl-3 font-sans text-xs font-semibold", accent.border, accent.text)}>
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-ink pt-5.5">
          <Button accent={accentKey} onClick={submit}>
            {mode === "edit" ? "Save changes" : (gov ? "Propose meeting" : "Create event")}
          </Button>
          <Button variant="secondary" onClick={handleLeave}>
            Cancel
          </Button>
        </div>
      </div>
      </TabbedPanel>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message={`You have unsaved changes to this ${gov ? "meeting" : "event"}. If you leave now, they'll be lost.`}
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onCancel}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
