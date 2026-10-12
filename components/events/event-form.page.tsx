"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ClipboardDocumentListIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { AgendaEditor, BLANK_AGENDA_ITEM, type AgendaDraft } from "./agenda-editor";
import { MeetingAvailability } from "./meeting-availability";
import { BLANK_SLOT, SlotsEditor, type SlotDraft } from "./slots-editor";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Avatar, Button, ConfirmModal, Eyebrow, Input, Label, MenuRow, PageContainer, Section, SectionGroup, Select, TextArea } from "@/components/shared";
import { audienceLabel, circleCanHost, circlesByKind, circlesForAudience, circlesForMember, indexCircles, isCircleMember, isRootCircle, isWithinCircle } from "@/lib/circles.util";
import { approvingRole } from "@/lib/circle-roles.util";
import { attendeeIds, defaultEventTimes, endAfterStartMoves, validateEventDraft, type EventDetails, type EventDraft, type RoleDraft, type SeriesScope } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { EVENT_KINDS, isProposal, majority } from "@/lib/governance.util";
import { REPEAT_FREQUENCIES, REPEAT_HORIZON_LABEL, localDay, repeatLabel, repeatSummary } from "@/lib/recurrence.util";
import type { Circle, Event, EventKindKey, Profile, RepeatFrequency } from "@/lib/types";


const DEFAULT_MEETING_TITLE = "Meeting";

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `border-t-${accent}`.
const ACCENT: Record<"ink" | "flame", { border: string; ring: string; text: string }> = {
  ink: { border: "border-ink", ring: "shadow-[inset_0_0_0_1px_var(--color-ink)]", text: "text-ink" },
  flame: { border: "border-flame", ring: "shadow-[inset_0_0_0_1px_var(--color-flame)]", text: "text-flame" },
};

const KIND_HINT: Record<EventKindKey, string> = {
  ordinary: "Something to attend",
  meeting: "A circle decides together",
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
  // start as a proposal hosted by this circle, shown to it
  initialHostCircleId?: string;
  // start shown to this circle, hosted by the person (a group, which can't host)
  initialCircleId?: string;
  onCreate:(draft: EventDraft) => Promise<SaveResult>;
}

interface EditEventFormPageProps extends EventFormPageBaseProps {
  mode: "edit";
  event: Event;
  // for a date of a repeating event: it and every later date not already
  // cancelled, soonest first — what "this and later dates" would touch
  laterDates: Event[];
  // `scope` is for a date of a repeating event: this one, or it and every later one
  onSave: (details: EventDetails, scope: SeriesScope) => Promise<SaveResult>;
  // cancel the event outright (see cancelEvent in lib/db/events.ts); the route
  // then leaves the form, for the event or, if it was deleted, the list
  onCancelEvent: (scope: SeriesScope) => Promise<SaveResult>;
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
  // only a circle they could pick as host themselves (see hostChoices below)
  const requestedHost = mode === "create" && props.initialHostCircleId ? byId[props.initialHostCircleId] : undefined;
  const initialHost = requestedHost && !isRootCircle(requestedHost) && circleCanHost(requestedHost) && isCircleMember(requestedHost, profile.id) ? requestedHost : undefined;
  // only a circle they could pick themselves
  const requestedCircle = mode === "create" && props.initialCircleId ? postable.find((c) => c.id === props.initialCircleId) : undefined;

  // the form's starting values — blank defaults for a new event, or the
  // event's own current values when editing. `dirty` (below) diffs live
  // state against these, not hardcoded blanks, so opening the edit form
  // doesn't itself count as a change.
  // read once, when the form opens, so the defaults (and what counts as a
  // change from them) don't move with the clock
  const [defaultTimes] = useState(() => defaultEventTimes());
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
        agenda: event.agenda && event.agenda.length > 0
          ? event.agenda.map((a): AgendaDraft => ({ category: a.category, title: a.title, details: a.details ?? "" }))
          : [BLANK_AGENDA_ITEM],
        slots: (event.roles ?? []).map((r): SlotDraft => ({ label: r.label, description: r.description || "", min: String(r.min), max: r.max != null ? String(r.max) : "" })),
      }
    : {
        type: "ordinary" as EventKindKey,
        title: "",
        circleId: initialHost?.id ?? requestedCircle?.id ?? postable[0]?.id ?? "",
        hostCircleId: initialHost?.id ?? "",
        // the next quarter hour from now, for two hours; starting values, so
        // leaving the form untouched still has nothing to discard
        ...defaultTimes,
        location: "",
        description: "",
        agenda: [BLANK_AGENDA_ITEM],
        slots: [] as SlotDraft[],
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
  const [slots, setSlots] = useState<SlotDraft[]>(initialValues.slots);
  // a meeting's agenda, which it has instead of a description
  const [agenda, setAgenda] = useState<AgendaDraft[]>(initialValues.agenda);
  // the form, or a part of it (slots, a meeting's agenda) on a view of its own:
  // too much to fit among the other fields on a phone
  const [view, setView] = useState<"form" | "slots" | "agenda">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // which dates cancelling applies to, while its confirmation is open
  const [confirmingCancel, setConfirmingCancel] = useState<SeriesScope | null>(null);
  // "" doesn't repeat; the last date is optional. Chosen only when creating.
  const [repeat, setRepeat] = useState<RepeatFrequency | "">("");
  const [until, setUntil] = useState("");
  // editing a date of a live series: that date alone, or every date from it on.
  // A circle-hosted series still up for its vote has just its first date, so
  // there's nothing to choose — an edit to it is to the series.
  const series = event?.repeat;
  const seriesLive = !!event && !!series && !isProposal(event);
  const [scope, setScope] = useState<SeriesScope>("one");

  const meta = EVENT_KINDS[type];
  const gov = meta.governance;
  // a circle can host an ordinary event (a meeting is always proposed by the person)
  const hostCircle = !gov ? byId[hostCircleId] : undefined;
  // the Leader, Secretary or Facilitator of the circle that would vote — a
  // meeting's own, or the host circle — approves it without a vote (the server
  // decides for real; an edit keeps what it decided then)
  const votingCircle = gov ? byId[circleId] : hostCircle;
  const approverRole = event ? (event.approvedByRole ?? null) : votingCircle ? approvingRole(votingCircle, profile.id) : null;
  const proposing = !approverRole && (gov || !!hostCircle);
  const accentKey = proposing ? "flame" : "ink";
  const accent = ACCENT[accentKey];

  // a meeting needs a roster to compute its majority, and the city's is
  // implicit — so meetings can't be held in it; nor in a group, which can't
  // hold one (see circleCanHost)
  const canHoldMeeting = (c: Circle) => !isRootCircle(c) && circleCanHost(c);
  const circleChoices = mode === "edit"
    ? (byId[initialValues.circleId] ? [byId[initialValues.circleId]!] : [])
    : postable.filter((c) => !gov || canHoldMeeting(c));
  const circle = byId[circleId];
  const circleGroups = circlesByKind(circleChoices);
  const meetingThresholdPreview = circle ? majority(circle.members.length) : 0;
  const hostThresholdPreview = hostCircle ? majority(hostCircle.members.length) : 0;
  // a circle can only host if it has members of its own — the city's roster is
  // implicit, so it isn't offered — and only an event shown to itself or to a
  // circle it's part of, so the options follow the Circle chosen above
  const parentOf = (id: string) => byId[id]?.parentId;
  const hostChoices = mode === "edit"
    ? (hostCircle ? [hostCircle] : [])
    : circlesForMember(profile.id, circles).filter((c) => !isRootCircle(c) && circleCanHost(c) && isWithinCircle(c.id, circleId, parentOf));
  const hostGroups = circlesByKind(hostChoices);

  // true once something differs from where the form started — guards Back/
  // Cancel behind a confirmation. Switching the Event/Meeting tab alone
  // doesn't count: it's a selection, not entered content (moot in edit mode
  // anyway, since that tab is disabled there).
  const dirty =
    // a new meeting's default title isn't a change of its own
    title.trim() !== (mode === "create" && gov && initialValues.title === "" ? DEFAULT_MEETING_TITLE : initialValues.title.trim()) ||
    circleId !== initialValues.circleId ||
    hostCircleId !== initialValues.hostCircleId ||
    date !== initialValues.date ||
    start !== initialValues.start ||
    end !== initialValues.end ||
    location.trim() !== initialValues.location.trim() ||
    description.trim() !== initialValues.description.trim() ||
    JSON.stringify(slots) !== JSON.stringify(initialValues.slots) ||
    (gov && JSON.stringify(agenda) !== JSON.stringify(initialValues.agenda)) ||
    repeat !== "" ||
    until !== "";

  // picking a different circle to show it to can leave the chosen host outside
  // it, so drop back to hosting it yourself
  function pickCircle(id: string) {
    setCircleId(id);
    if (hostCircleId && !isWithinCircle(hostCircleId, id, parentOf)) setHostCircleId("");
  }

  function changeType(next: EventKindKey) {
    setType(next);
    setError("");
    // a meeting starts out titled plainly "Meeting", which switching back to an
    // event takes away again, as long as it hasn't been edited
    if (EVENT_KINDS[next].governance && !title.trim()) setTitle(DEFAULT_MEETING_TITLE);
    if (!EVENT_KINDS[next].governance && title === DEFAULT_MEETING_TITLE) setTitle("");
    // a meeting is proposed by the person, not hosted by a circle, and
    // doesn't repeat (yet)
    if (EVENT_KINDS[next].governance) {
      setHostCircleId("");
      setRepeat("");
      setUntil("");
    }
    // the city and a group can't hold a meeting, so step off either when switching to one
    if (EVENT_KINDS[next].governance && circle && !canHoldMeeting(circle)) {
      setCircleId(postable.find(canHoldMeeting)?.id ?? "");
    }
  }

  const hasRoles = slots.some((x) => x.label.trim());
  function openView(next: "slots" | "agenda") {
    // a blank one to type into, if there's none yet
    if (next === "slots" && slots.length === 0) setSlots([{ ...BLANK_SLOT }]);
    setView(next);
  }
  function closeView() {
    // slots nobody named are just dropped
    if (view === "slots") setSlots(slots.filter((x) => x.label.trim()));
    setView("form");
  }

  // leaving is the top bar's Back, which asks before discarding changes; from
  // a view within the form it goes back to the form instead
  useBackHandler(view !== "form" ? closeView : dirty ? () => setConfirmingDiscard(true) : null);

  // the event as it would be submitted, and the first thing wrong with it if
  // anything is — worked out on every render, so the submit buttons stay
  // disabled until it would pass. Instant feedback only: the server
  // re-validates and is the real check.
  function buildDraft(): { details: EventDetails; problem: string | null } {
    // blank slot rows are just ignored
    const roles: RoleDraft[] = !gov
      ? slots
          .filter((x) => x.label.trim())
          .map((x) => ({
            label: x.label.trim(),
            ...(x.description.trim() ? { description: x.description.trim() } : {}),
            min: parseInt(x.min, 10) || 0,
            ...(x.max !== "" ? { max: parseInt(x.max, 10) } : {}),
          }))
      : [];
    const details: EventDetails = {
      title: title.trim(),
      date, start, end,
      location: location.trim(),
      description: gov ? "" : description.trim() || "No description yet.",
      // a wholly blank item is just ignored, like a blank slot
      ...(gov
        ? {
            agenda: agenda
              .filter((a) => a.title.trim() || a.details.trim())
              .map((a) => ({ category: a.category, title: a.title.trim(), ...(a.details.trim() ? { details: a.details.trim() } : {}) })),
          }
        : {}),
      roles,
    };
    return {
      details,
      problem: validateEventDraft(
        { ...details, kind: type, circleId, ...(hostCircle ? { hostCircleId: hostCircle.id } : {}), ...repeatDraft() },
        { creating: mode === "create" }
      ),
    };
  }
  function repeatDraft(): Pick<EventDraft, "repeat"> {
    return repeat ? { repeat: { frequency: repeat, ...(until ? { until } : {}) } } : {};
  }
  const draftProblem = buildDraft().problem;
  // and, when editing, only once something's changed — saving the event as it
  // already is would do nothing
  const canSubmit = !busy && !draftProblem && (mode === "create" || dirty);

  async function submit() {
    if (busy) return;
    const { details, problem } = buildDraft();
    const roles = details.roles;
    if (problem) return fail(problem);

    setError("");
    setBusy(true);
    const result = mode === "edit"
      ? await props.onSave(details, scope)
      : await props.onCreate({ ...details, kind: type, circleId, roles, ...(hostCircle ? { hostCircleId: hostCircle.id } : {}), ...repeatDraft() });
    setBusy(false);
    if (!result.ok) fail(result.error);
  }

  // who else is going (the organizer doesn't count): decides whether cancelling
  // keeps it, marked cancelled, or deletes it — the server decides for real
  const othersGoing = event ? attendeeIds(event).filter((m) => m !== profile.id).length : 0;
  // the same across every date from this one on, for cancelling them all
  const laterDates = mode === "edit" ? props.laterDates : [];
  const othersGoingLater = new Set(laterDates.flatMap((e) => attendeeIds(e)).filter((m) => m !== profile.id)).size;
  async function cancelTheEvent(cancelScope: SeriesScope) {
    if (mode !== "edit" || busy) return;
    setConfirmingCancel(null);
    setBusy(true);
    const result = await props.onCancelEvent(cancelScope);
    setBusy(false);
    if (!result.ok) fail(result.error);
  }
  const noun = gov ? "meeting" : "event";
  const cancelLabel = (s: SeriesScope) =>
    s === "upcoming" ? "Cancel this and later dates" : `${othersGoing > 0 ? "Cancel" : "Delete"} ${seriesLive ? "this date" : noun}`;

  const submitLabel = mode === "edit" ? "Save changes" : (gov ? (approverRole ? "Schedule meeting" : "Propose meeting") : hostCircle && !approverRole ? "Propose event" : "Create event");
  useTopBarAction(
    view !== "form"
      ? { label: "Done", icon: CheckIcon, onAction: closeView, variant: "primary" }
      : { label: busy ? "Saving" : submitLabel, icon: CheckIcon, onAction: submit, disabled: !canSubmit, variant: "primary" }
  );

  // The error sits at the foot of the form, and on mobile the submit that
  // caused it is the top bar's check, so it's brought into view — on every
  // failed attempt, including one with the same message as the last.
  const errorRef = useRef<HTMLDivElement>(null);
  const [failures, setFailures] = useState(0);
  function fail(message: string) {
    setError(message);
    setFailures((n) => n + 1);
  }
  useEffect(() => {
    if (failures > 0) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [failures]);

  const types: [EventKindKey, string][] = [
    ["ordinary", "Event"],
    ["meeting", "Meeting"],
  ];

  const circleSelect = (
    <Select id="circle" value={circleId} onChange={(e) => pickCircle(e.target.value)} disabled={mode === "edit"}>
      {circleGroups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.circles.map((c) => (
            <option key={c.id} value={c.id}>{isRootCircle(c) ? `${c.name} (Everyone)` : c.name}</option>
          ))}
        </optgroup>
      ))}
    </Select>
  );

  const topics = agenda.filter((a) => a.title.trim());
  const roleNames = slots.filter((x) => x.label.trim()).map((x) => x.label.trim());

  if (view === "slots") {
    return (
      <PageContainer size="compact">
        <h2 className="font-sans text-xl font-extrabold tracking-[-0.02em]">Roles</h2>
        <p className="mt-2 mb-5 font-serif text-sm leading-normal text-soft">
          People sign up for these, like shift lead or greeter. Roles replace the normal RSVP. Leave none to keep it a simple RSVP.
        </p>
        <SlotsEditor slots={slots} onChange={setSlots} />
      </PageContainer>
    );
  }

  if (view === "agenda") {
    return (
      <PageContainer size="compact">
        <h2 className="font-sans text-xl font-extrabold tracking-[-0.02em]">Agenda</h2>
        <p className="mt-2 mb-5 font-serif text-sm leading-normal text-soft">
          Mark each topic with what the circle will do with it: hear a report, explore it together, or decide it.
        </p>
        <AgendaEditor items={agenda} onChange={setAgenda} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="compact">
      {/* a choice, not navigation: two options that each say what they are,
          the chosen one outlined (orange once it's a proposal). The kind can't
          change once an event exists, so only a new one asks. */}
      {mode === "create" ? (
        <div role="radiogroup" aria-label="What you're making" className="grid grid-cols-2 gap-3">
          {types.map(([key, label]) => {
            const on = key === type;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => changeType(key)}
                className={clsx(
                  "relative flex cursor-pointer flex-col items-stretch justify-start border bg-paper px-4 py-3.5 text-left",
                  on ? clsx(accent.border, accent.ring) : "border-faint",
                )}
              >
                <span className={clsx("block font-sans text-base font-bold", on ? accent.text : "text-soft")}>{label}</span>
                <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{KIND_HINT[key]}</span>
                {on && <CheckIcon className={clsx("absolute top-3 right-3 size-4", accent.text)} strokeWidth={3} aria-hidden />}
              </button>
            );
          })}
        </div>
      ) : (
        proposing && <Eyebrow className="text-flame">Proposal</Eyebrow>
      )}

      {/* a meeting is the circle's own, so which circle comes first, with what
          that means for it right under the choice (an event's is further down) */}
      {gov && (
        <div className="mt-5">
          <Label htmlFor="circle">Which circle is meeting?</Label>
          {circleSelect}
          {circle && approverRole && (
            <p className="mt-3 border-l-[3px] border-leaf pl-3 font-serif text-sm leading-normal text-[#222]">
              As {circle.name}&apos;s <strong>{approverRole}</strong>, you schedule it directly — it doesn&apos;t need a vote, and {circle.type === "neighborhood" ? "residents" : "members"} RSVP as they would to any event.
            </p>
          )}
          {circle && !approverRole && (
            <p className="mt-3 border-l-[3px] border-flame pl-3 font-serif text-sm leading-normal text-[#222]">
              <strong>{meetingThresholdPreview} votes</strong> from {circle.type === "neighborhood" ? "residents" : "members"} of {circle.name} approve it. Your proposal counts as the first.
            </p>
          )}
          {mode === "edit" && <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">The circle can&apos;t be changed once a meeting exists.</p>}
        </div>
      )}

      <SectionGroup>
        <Section className="py-6">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={gov ? "What is this meeting about?" : "What's happening?"} />
        </Section>

        <Section className="flex flex-col gap-5 py-6">
          <div className="grid grid-cols-1 gap-3.5 min-[720px]:grid-cols-3">
            <div>
              <Label htmlFor="date">Date</Label>
              {/* the day only moves one date at a time */}
              <Input
                id="date"
                type="date"
                value={date}
                // the date picker greys out days before today; the time is
                // checked when the form is (validateEventDraft)
                min={localDay()}
                onChange={(e) => setDate(e.target.value)}
                disabled={seriesLive && scope === "upcoming"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5 min-[720px]:col-span-2">
              <div>
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="time"
                  value={start}
                  onChange={(e) => {
                    // the end moves with it, keeping the event's length
                    setEnd(endAfterStartMoves(start, end, e.target.value));
                    setStart(e.target.value);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="end">End</Label>
                <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {gov && circleId && <MeetingAvailability circleId={circleId} date={date} start={start} end={end} needed={proposing ? meetingThresholdPreview : undefined} />}

          {mode === "create" ? (!gov && (
            <div className="grid grid-cols-1 gap-3.5 min-[720px]:grid-cols-3">
              <div className={repeat ? "min-[720px]:col-span-2" : "min-[720px]:col-span-3"}>
                <Label htmlFor="repeat">Repeats</Label>
                <Select id="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatFrequency | "")}>
                  <option value="">Doesn&apos;t repeat</option>
                  {REPEAT_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{repeatLabel(f, date)}</option>
                  ))}
                </Select>
              </div>
              {repeat && (
                <div>
                  <Label htmlFor="until">Until (optional)</Label>
                  <Input id="until" type="date" value={until} min={date || undefined} onChange={(e) => setUntil(e.target.value)} />
                </div>
              )}
              {repeat && (
                <p className="font-serif text-sm leading-[1.45] text-soft min-[720px]:col-span-3">
                  Each date is its own event, with its own {hasRoles ? "roles" : "RSVPs"}, and dates are added {REPEAT_HORIZON_LABEL[repeat]} ahead.{" "}
                  {hostCircle && !approverRole
                    ? `${hostCircle.name} votes once, on the first date: approving it approves them all.`
                    : "Members are told once, when it's created."}
                </p>
              )}
            </div>
          )) : series && (
            <div>
              <Label htmlFor="scope">Repeats</Label>
              <p className="mb-2.5 font-serif text-base">{repeatSummary(series)}</p>
              {seriesLive ? (
                <>
                  <Select id="scope" value={scope} onChange={(e) => { setScope(e.target.value as SeriesScope); setDate(initialValues.date); }}>
                    <option value="one">Save changes to this date only</option>
                    <option value="upcoming">Save changes to this and later dates</option>
                  </Select>
                  <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
                    {scope === "upcoming"
                      ? `Changes apply to this date${laterDates.length > 1 ? `, the ${laterDates.length === 2 ? "one" : laterDates.length - 1} after it,` : ""} and every date still to come. The day itself can only be moved one date at a time.`
                      : "Only this date changes; the others stay as they are."}
                  </p>
                </>
              ) : (
                <p className="font-serif text-sm leading-[1.45] text-soft">
                  While it&apos;s waiting on its vote, changes apply to the whole series.
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where should people go?" />
          </div>
        </Section>

        <Section className="flex flex-col gap-4 py-6">
          {gov ? (
            <MenuRow
              onClick={() => openView("agenda")}
              icon={ClipboardDocumentListIcon}
              label="Agenda"
              detail={topics.length > 0 ? `${topics.length} ${topics.length === 1 ? "topic" : "topics"}: ${topics.map((a) => a.title.trim()).join(", ")}` : "Add what you'll cover"}
            />
          ) : (
            <>
              <div>
                <Label htmlFor="description">Description</Label>
                <TextArea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What's it about, what to bring, who it's for…" />
              </div>
              <MenuRow
                onClick={() => openView("slots")}
                icon={HandRaisedIcon}
                label="Roles"
                detail={hasRoles ? `${roleNames.length} ${roleNames.length === 1 ? "role" : "roles"}: ${roleNames.join(", ")}` : "Add roles to sign up for."}
              />
            </>
          )}
        </Section>

        <Section className="flex flex-col gap-5 py-6">
          {!gov && (
          <div>
            <Label htmlFor="circle">Shown to</Label>
            {circleSelect}
            {circle && (
              <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
                {isRootCircle(circle)
                  ? `${proposing ? "Once approved, everyone" : "Everyone"} in the city can see this and RSVP.`
                  : `${proposing ? "Once approved, only" : "Only"} ${audienceLabel(circle)} can see this, RSVP and be notified about it.`}
                {mode === "edit" && " The circle can't be changed once an event exists."}
              </p>
            )}
          </div>
          )}

          {gov ? (
            <div>
              <Label>{approverRole ? "Scheduled by" : "Proposed by"}</Label>
              <div className="flex items-center gap-2.5 border border-ink bg-paper px-3 py-2.75">
                <Avatar member={profile} size={26} />
                <span className="font-sans text-sm font-bold">{profile.name} (you)</span>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="host">Hosted by</Label>
              <Select id="host" value={hostCircleId} onChange={(e) => setHostCircleId(e.target.value)} disabled={mode === "edit"}>
                <option value="">{profile.name} (you)</option>
                {hostGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.circles.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              {hostCircle && circle && (
                <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
                  {mode === "edit"
                    ? `Hosted by ${hostCircle.name}, so it can't be re-hosted once proposed.`
                    : approverRole
                    ? `As ${hostCircle.name}'s ${approverRole}, you approve it yourself, with no vote. It opens to ${audienceLabel(circle)} as soon as you create it.`
                    : `This is a proposal. It needs ${hostThresholdPreview} approving votes from ${hostCircle.type === "neighborhood" ? "residents" : "members"} of ${hostCircle.name}, and yours counts as the first. Until then only they can see it; once approved it opens to ${audienceLabel(circle)}.`}
                </p>
              )}
            </div>
          )}
        </Section>
      </SectionGroup>

      {error && (
        <div ref={errorRef} className={clsx("border-l-[3px] pl-3 font-sans text-xs font-semibold", accent.border, accent.text)}>
          {error}
        </div>
      )}

      {/* cancelling the event itself (not this form): on every screen size,
          since it isn't one of the form's own buttons */}
      {mode === "edit" && !isPastEvent(props.event) && (
        <div className="mt-8 border-t border-ink pt-5.5">
          <Eyebrow className="text-soft">Cancel {noun}</Eyebrow>
          <p className="mt-2 mb-4 font-serif text-sm leading-normal text-soft">
            {othersGoing > 0
              ? `Everyone going will be emailed, and it'll stay listed as cancelled.`
              : `No one else is going yet, so it'll be deleted.`}{" "}
            {seriesLive && "Cancelling this and later dates also stops new ones being added. "}
            This can&apos;t be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" onClick={() => setConfirmingCancel("one")} disabled={busy}>
              {cancelLabel("one")}
            </Button>
            {seriesLive && (
              <Button variant="danger" onClick={() => setConfirmingCancel("upcoming")} disabled={busy}>
                {cancelLabel("upcoming")}
              </Button>
            )}
          </div>
        </div>
      )}

      {confirmingCancel && (
        <ConfirmModal
          title={confirmingCancel === "upcoming" ? "Cancel this and later dates?" : `Cancel this ${seriesLive ? "date" : noun}?`}
          message={confirmingCancel === "upcoming"
            ? `That's ${laterDates.length} date${laterDates.length === 1 ? "" : "s"} so far, and no more will be added. ${othersGoingLater > 0
                ? `${othersGoingLater} ${othersGoingLater === 1 ? "person is" : "people are"} going to at least one — they'll each get one email, and those dates stay listed as cancelled. Dates no one else is going to are deleted.`
                : "No one else is going to any of them, so they'll be deleted."} This can't be undone.`
            : othersGoing > 0
              ? `${othersGoing} ${othersGoing === 1 ? "person is" : "people are"} going. They'll be emailed that it's cancelled, and it'll stay listed as cancelled. This can't be undone.`
              : `No one else is going, so it'll be deleted. This can't be undone.`}
          confirmLabel={cancelLabel(confirmingCancel)}
          cancelLabel="Keep it"
          onConfirm={() => cancelTheEvent(confirmingCancel)}
          onCancel={() => setConfirmingCancel(null)}
        />
      )}

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
