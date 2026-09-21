"use client";

import { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, BackButton, Button, ConfirmModal, Eyebrow, Input, Label, PageContainer, Select, TabbedPanel, TextArea } from "@/components/shared";
import { audienceLabel, circlesForAudience, circlesForMember, indexCircles, isRootCircle, isWithinCircle } from "@/lib/circles.util";
import { validateEventDraft, type EventDetails, type EventDraft, type RoleDraft } from "@/lib/events.util";
import { EVENT_KINDS, majority } from "@/lib/governance.util";
import type { Circle, Event, EventKindKey, Profile } from "@/lib/types";

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

// what the route hands back once the server has answered, so a refusal shows inline
type SaveResult = { ok: true } | { ok: false; error: string };

interface EventFormPageBaseProps {
  profile: Profile;
  circles: Circle[];
  onCancel: () => void;
}

interface CreateEventFormPageProps extends EventFormPageBaseProps {
  mode: "create";
  onCreate: (draft: EventDraft) => Promise<SaveResult>;
}

interface EditEventFormPageProps extends EventFormPageBaseProps {
  mode: "edit";
  event: Event;
  onSave: (details: EventDetails) => Promise<SaveResult>;
}

type EventFormPageProps = CreateEventFormPageProps | EditEventFormPageProps;

/* Shared by /events/new (mode "create") and /events/[id]/edit (mode "edit")
   — the same form either way, just seeded from blank defaults or from the
   event being edited. Editing can't change the event's kind (ordinary vs
   meeting): the tab for whichever kind the event ISN'T gets disabled rather
   than removed, so the tab bar's shape stays identical between the two
   modes. The circle is likewise locked once an event exists — moving it would
   silently change who can see it, and likewise the host. "Hosted by" is either
   the person filling this in or one of their circles: a circle-hosted event is
   a proposal its members vote on before it goes live, so the form flips to the
   orange "propose" treatment the meeting tab already has. */
export function EventFormPage(props: EventFormPageProps) {
  const { profile, circles, onCancel, mode } = props;
  const event = mode === "edit" ? props.event : null;

  // where a new event can go: the circles the person belongs to, plus the city
  // (everyone is in it). Their home neighborhood sorts first as the likeliest
  // default, the city last.
  const byId = indexCircles(circles);
  const rank = (c: Circle) => (c.id === profile.homeCircleId ? 0 : isRootCircle(c) ? 2 : 1);
  const postable = circlesForAudience(profile.id, circles).sort((x, y) => rank(x) - rank(y));

  // the form's starting values — blank defaults for a new event, or the
  // event's own current values when editing. `dirty` (below) diffs live
  // state against these, not hardcoded blanks, so opening the edit form
  // doesn't itself count as a change.
  const initialValues = event
    ? {
        type: (event.kind === "meeting" ? "meeting" : "ordinary") as EventKindKey,
        title: event.title,
        circleId: event.circleId,
        hostCircleId: event.hostCircleId ?? "",
        date: event.date,
        start: event.start,
        end: event.end,
        location: event.location,
        description: event.description,
        useSlots: Array.isArray(event.roles) && event.roles.length > 0,
        slots: event.roles && event.roles.length > 0
          ? event.roles.map((r): SlotDraft => ({ label: r.label, description: r.description || "", min: String(r.min), max: r.max != null ? String(r.max) : "" }))
          : DEFAULT_SLOTS,
      }
    : {
        type: "ordinary" as EventKindKey,
        title: "",
        circleId: postable[0]?.id ?? "",
        hostCircleId: "",
        date: "",
        start: DEFAULT_START,
        end: DEFAULT_END,
        location: "",
        description: "",
        useSlots: false,
        slots: DEFAULT_SLOTS,
      };

  const [type, setType] = useState<EventKindKey>(initialValues.type);
  const [title, setTitle] = useState(initialValues.title);
  const [circleId, setCircleId] = useState(initialValues.circleId);
  // "" means the person themselves hosts it
  const [hostCircleId, setHostCircleId] = useState(initialValues.hostCircleId);
  const [date, setDate] = useState(initialValues.date);
  const [start, setStart] = useState(initialValues.start);
  const [end, setEnd] = useState(initialValues.end);
  const [location, setLocation] = useState(initialValues.location);
  const [description, setDescription] = useState(initialValues.description);
  // slots (roles) for an ordinary event: each { label, description, min, max }
  const [useSlots, setUseSlots] = useState(initialValues.useSlots);
  const [slots, setSlots] = useState<SlotDraft[]>(initialValues.slots);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const meta = EVENT_KINDS[type];
  const gov = meta.governance;
  // a circle can host an ordinary event (a meeting is always proposed by the person)
  const hostCircle = !gov ? byId[hostCircleId] : undefined;
  const proposing = gov || !!hostCircle;
  const accentKey = proposing ? "flame" : "ink";
  const accent = ACCENT[accentKey];

  // a meeting needs a roster to compute its majority, and the city's is
  // implicit — so meetings can't be held in it
  const circleChoices = mode === "edit"
    ? (byId[initialValues.circleId] ? [byId[initialValues.circleId]!] : [])
    : postable.filter((c) => !gov || !isRootCircle(c));
  const circle = byId[circleId];
  const circleOptions = circleChoices.map((c) => ({ id: c.id, label: isRootCircle(c) ? `${c.name} (Everyone)` : c.name }));
  const meetingThresholdPreview = circle ? majority(circle.members.length) : 0;
  const hostThresholdPreview = hostCircle ? majority(hostCircle.members.length) : 0;
  // a circle can only host if it has members of its own — the city's roster is
  // implicit, so it isn't offered — and only an event shown to itself or to a
  // circle it's part of, so the options follow the Circle chosen above
  const parentOf = (id: string) => byId[id]?.parentId;
  const hostChoices = mode === "edit"
    ? (hostCircle ? [hostCircle] : [])
    : circlesForMember(profile.id, circles).filter((c) => !isRootCircle(c) && isWithinCircle(c.id, circleId, parentOf));
  const hostOptions = [
    { id: "", label: `${profile.name} (you)` },
    ...hostChoices.map((c) => ({ id: c.id, label: c.name })),
  ];

  // true once something differs from where the form started — guards Back/
  // Cancel behind a confirmation. Switching the Event/Meeting tab alone
  // doesn't count: it's a selection, not entered content (moot in edit mode
  // anyway, since that tab is disabled there).
  const dirty =
    title.trim() !== initialValues.title.trim() ||
    circleId !== initialValues.circleId ||
    hostCircleId !== initialValues.hostCircleId ||
    date !== initialValues.date ||
    start !== initialValues.start ||
    end !== initialValues.end ||
    location.trim() !== initialValues.location.trim() ||
    description.trim() !== initialValues.description.trim() ||
    useSlots !== initialValues.useSlots ||
    JSON.stringify(slots) !== JSON.stringify(initialValues.slots);

  // picking a different circle to show it to can leave the chosen host outside
  // it, so drop back to hosting it yourself
  function pickCircle(id: string) {
    setCircleId(id);
    if (hostCircleId && !isWithinCircle(hostCircleId, id, parentOf)) setHostCircleId("");
  }

  function changeType(next: EventKindKey) {
    setType(next);
    setError("");
    // a meeting is proposed by the person, not hosted by a circle
    if (EVENT_KINDS[next].governance) setHostCircleId("");
    // the city can't hold a meeting, so step off it when switching to one
    if (EVENT_KINDS[next].governance && circle && isRootCircle(circle)) {
      setCircleId(postable.find((c) => !isRootCircle(c))?.id ?? "");
    }
  }

  // shared by the top BackButton and the bottom Cancel button — both leave
  // the form the same way, so both need the same unsaved-changes guard.
  function handleLeave() {
    if (dirty) setConfirmingDiscard(true);
    else onCancel();
  }

  async function submit() {
    if (busy) return;
    // blank slot rows are just ignored, but turning slots on with none filled is a mistake
    let roles: RoleDraft[] = [];
    if (!gov && useSlots) {
      roles = slots
        .filter((x) => x.label.trim())
        .map((x) => ({
          label: x.label.trim(),
          ...(x.description.trim() ? { description: x.description.trim() } : {}),
          min: parseInt(x.min, 10) || 0,
          ...(x.max !== "" ? { max: parseInt(x.max, 10) } : {}),
        }));
      if (roles.length === 0) return setError("Add at least one slot, or turn off slots.");
    }
    const details: EventDetails = {
      title: title.trim(),
      date, start, end,
      location: location.trim(),
      description: description.trim() || (gov ? "No agenda yet." : "No description yet."),
      roles,
    };
    // instant feedback only — the server re-validates and is the real check
    const problem = validateEventDraft({ ...details, kind: type, circleId, ...(hostCircle ? { hostCircleId: hostCircle.id } : {}) });
    if (problem) return setError(problem);

    setError("");
    setBusy(true);
    const result = mode === "edit"
      ? await props.onSave(details)
      : await props.onCreate({ ...details, kind: type, circleId, roles, ...(hostCircle ? { hostCircleId: hostCircle.id } : {}) });
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  const types: [EventKindKey, string][] = [
    ["ordinary", "Event"],
    ["meeting", "Meeting"],
  ];

  return (
    <PageContainer size="compact">
      <BackButton onClick={handleLeave}>{mode === "edit" ? initialValues.title : "All events"}</BackButton>

      <div className={clsx("mt-4 border-t-[3px] border-b border-b-ink pt-4 pb-5", accent.borderT)}>
        <Eyebrow className={proposing ? "text-flame" : "text-soft"}>{mode === "edit" ? "Edit" : (proposing ? "Propose" : "Create")}</Eyebrow>
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
        onChange={(key) => changeType(key as EventKindKey)}
        className="mt-6"
      >
      {gov && circle && (
        <p className="mb-1 border-l-[3px] border-flame pl-3 font-serif text-sm leading-normal text-[#222]">
          This is a governance meeting for <strong>{circle.name}</strong>. Once proposed it needs <strong>{meetingThresholdPreview} votes from {circle.type === "neighborhood" ? "residents" : "members"}</strong> to be approved. Your proposal counts as the first vote.
        </p>
      )}

      <div className={clsx("flex flex-col gap-5.5", gov && "pt-5.5")}>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={gov ? "What is this meeting about?" : "What's happening?"} />
        </div>

        <div>
          <Label htmlFor="circle">Circle</Label>
          <Select id="circle" value={circleId} onChange={(e) => pickCircle(e.target.value)} disabled={mode === "edit"}>
            {circleOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
          {circle && (
            <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
              {isRootCircle(circle)
                ? `${hostCircle ? "Once approved, everyone" : "Everyone"} in the city can see this and RSVP.`
                : `${hostCircle ? "Once approved, only" : "Only"} ${audienceLabel(circle)} can see this, RSVP and be notified about it.`}
              {mode === "edit" && " The circle can't be changed once an event exists."}
            </p>
          )}
        </div>

        {gov ? (
          <div>
            <Label>Proposed by</Label>
            <div className="flex items-center gap-2.5 border border-ink bg-paper px-3 py-2.75">
              <Avatar member={profile} size={26} />
              <span className="font-sans text-sm font-bold">{profile.name} (you)</span>
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="host">Hosted by</Label>
            <Select id="host" value={hostCircleId} onChange={(e) => setHostCircleId(e.target.value)} disabled={mode === "edit"}>
              {hostOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
            {hostCircle && circle && (
              <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
                {mode === "edit"
                  ? `Hosted by ${hostCircle.name}, so it can't be re-hosted once proposed.`
                  : `This is a proposal. It needs ${hostThresholdPreview} approving votes from ${hostCircle.type === "neighborhood" ? "residents" : "members"} of ${hostCircle.name}, and yours counts as the first. Until then only they can see it; once approved it opens to ${audienceLabel(circle)}.`}
              </p>
            )}
          </div>
        )}

        {!gov && (
            <div className={clsx("border px-4 py-3.5", useSlots ? "border-ink" : "border-faint")}>
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
          <Button accent={accentKey} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : (gov ? "Propose meeting" : hostCircle ? "Propose event" : "Create event")}
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
