"use client";

import { useEffect, useRef, useState } from "react";
import { BellAlertIcon, CheckIcon, ClipboardDocumentListIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { AgendaEditor, BLANK_AGENDA_ITEM, type AgendaDraft } from "./agenda-editor";
import { MeetingAvailability } from "./meeting-availability";
import { BLANK_SLOT, SlotsEditor, type SlotDraft } from "./slots-editor";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Avatar, Button, ConfirmModal, Eyebrow, Input, Label, MenuRow, PageContainer, FederationExplorerField, Section, SectionGroup, Select, SettingRow, SettingRows, useFederationExplorer, TextArea } from "@/components/shared";
import { audienceLabel, circleCanHoldMeetings, circlesForAudience, circlesForMember, indexCircles, isCircleMember, memberCirclesWithPaths, hostCanShowTo, circleIsPrivate, isRootCircle, isWithinCircle } from "@/lib/circles.util";
import { approvingRole } from "@/lib/circle-roles.util";
import { DEFAULT_REMINDERS, REMINDERS, attendeeIds, availableReminders, defaultReminders, defaultEventTimes, endAfterStartMoves, remindersSummary, validateEventDraft, type EventDetails, type EventDraft, type RoleDraft, type SeriesScope } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { useClock } from "@/lib/hooks";
import { EVENT_KINDS, isProposal } from "@/lib/governance.util";
import { REPEAT_FREQUENCIES, REPEAT_HORIZON_LABEL, localDay, repeatLabel, repeatSummary } from "@/lib/recurrence.util";
import type { Circle, Event, EventKindKey, Profile, ReminderHours, RepeatFrequency } from "@/lib/types";


const DEFAULT_MEETING_TITLE = "Meeting";

// the same reminders, whatever order they were switched on in
const sameReminders = (a: ReminderHours[], b: ReminderHours[]) => a.length === b.length && a.every((h) => b.includes(h));

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
  // start shown to this circle, hosted by the person (a group, which can't
  // host), or as its meeting
  initialCircleId?: string;
  // start on the Meeting tab (the Events list's New meeting)
  initialKind?: EventKindKey;
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
   a proposal its members consent to before it goes live, so the form flips to the
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
  const initialHost = requestedHost && !isRootCircle(requestedHost) && isCircleMember(requestedHost, profile.id) ? requestedHost : undefined;
  // only a circle they could pick themselves
  const requestedCircle = mode === "create" && props.initialCircleId ? postable.find((c) => c.id === props.initialCircleId) : undefined;
  // opened as a meeting: started as switching to the Meeting tab leaves it
  // (see changeType), titled "Meeting", in a circle that can hold one: the
  // one it was opened from (a circle page's New meeting), or the first
  const holdsMeetings = (c: Circle) => !isRootCircle(c) && circleCanHoldMeetings(c);
  const startsAsMeeting = mode === "create" && props.initialKind === "meeting";
  const firstMeetingCircle = requestedCircle && holdsMeetings(requestedCircle) ? requestedCircle : postable.find(holdsMeetings);

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
        reminders: event.reminders ?? DEFAULT_REMINDERS,
      }
    : {
        type: (startsAsMeeting ? "meeting" : "ordinary") as EventKindKey,
        title: startsAsMeeting ? DEFAULT_MEETING_TITLE : "",
        circleId: startsAsMeeting ? (firstMeetingCircle?.id ?? "") : (initialHost?.id ?? requestedCircle?.id ?? postable[0]?.id ?? ""),
        hostCircleId: startsAsMeeting ? "" : (initialHost?.id ?? ""),
        // the next quarter hour from now, for two hours; starting values, so
        // leaving the form untouched still has nothing to discard
        ...defaultTimes,
        location: "",
        description: "",
        agenda: [BLANK_AGENDA_ITEM],
        slots: [] as SlotDraft[],
        reminders: DEFAULT_REMINDERS,
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
  // when the people going are reminded of it, in hours before it
  const [reminders, setReminders] = useState<ReminderHours[]>(initialValues.reminders);
  // a new event's reminders follow its date and time (defaultReminders) until
  // they're changed by hand; an edited event's are its own from the start
  const [remindersSet, setRemindersSet] = useState(mode === "edit");
  // only the ones that can still come before it starts are offered, as the
  // clock and its date and time say (all of them until the clock is read)
  const now = useClock();
  const available = now === null ? REMINDERS.map((r) => r.hours) : availableReminders({ date, start }, new Date(now));
  const chosen = remindersSet ? reminders : defaultReminders(available);
  // the form, or a part of it (slots, a meeting's agenda, the reminders) on a
  // view of its own: too much to fit among the other fields on a phone
  const [view, setView] = useState<"form" | "slots" | "agenda" | "reminders">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // the roles, agenda and reminders as they were when their view opened: Done
  // keeps what's changed since, Back puts these back (asking first if anything has)
  const [viewStart, setViewStart] = useState<{ slots: SlotDraft[]; agenda: AgendaDraft[]; reminders: ReminderHours[]; remindersSet: boolean } | null>(null);
  const [confirmingViewDiscard, setConfirmingViewDiscard] = useState(false);
  // which dates cancelling applies to, while its confirmation is open
  const [confirmingProposal, setConfirmingProposal] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState<SeriesScope | null>(null);
  // "" doesn't repeat; the last date is optional. Chosen only when creating.
  const [repeat, setRepeat] = useState<RepeatFrequency | "">("");
  const [until, setUntil] = useState("");
  // editing a date of a live series: that date alone, or every date from it on.
  // A circle-hosted series still waiting on its consent has just its first date, so
  // there's nothing to choose — an edit to it is to the series.
  const series = event?.repeat;
  const seriesLive = !!event && !!series && !isProposal(event);
  const [scope, setScope] = useState<SeriesScope>("one");

  const meta = EVENT_KINDS[type];
  const gov = meta.governance;
  // a circle can host an ordinary event (a meeting is always proposed by the person)
  const hostCircle = !gov ? byId[hostCircleId] : undefined;
  // anyone holding a role in a meeting's circle schedules it directly (the
  // server decides for real; an edit keeps what it decided then); every other
  // meeting, and every event a circle hosts, is proposed to it for consent
  const meetingCircle = gov ? byId[circleId] : undefined;
  const approverRole = event ? (event.approvedByRole ?? null) : meetingCircle ? approvingRole(meetingCircle, profile.id) : null;
  const proposing = (gov && !approverRole) || !!hostCircle;
  const accentKey = proposing ? "flame" : "ink";
  const accent = ACCENT[accentKey];

  // a meeting needs a roster of members to consent, and the city's is
  // implicit — so meetings can't be held in it; nor in a group, which can't
  // hold one (see circleCanHoldMeetings)
  const canHoldMeeting = (c: Circle) => !isRootCircle(c) && circleCanHoldMeetings(c);
  const circleChoices = mode === "edit"
    ? (byId[initialValues.circleId] ? [byId[initialValues.circleId]!] : [])
    : postable.filter((c) => !gov || canHoldMeeting(c));
  const circle = byId[circleId];
  // a circle can only host if it has members of its own — the city's roster is
  // implicit, so it isn't offered — and only an event shown to itself or to a
  // circle it's part of, so the options follow the Circle chosen above
  const parentOf = (id: string) => byId[id]?.parentId;
  const hostChoices = mode === "edit"
    ? (hostCircle ? [hostCircle] : [])
    : circlesForMember(profile.id, circles).filter((c) => !isRootCircle(c) && hostCanShowTo(c, circleId, parentOf));

  // every circle can be browsed in the explorer; the rest say why they can't be chosen
  // only the member's own circles (and the way down to them), not the whole federation
  const explorable = memberCirclesWithPaths(profile.id, circles);
  const you = { id: profile.id, homeCircleId: profile.homeCircleId };
  const circleExplorer = useFederationExplorer({
    title: gov ? "Which circle is meeting?" : "Shown to",
    circles: explorable,
    value: circleId || null,
    onChange: pickCircle,
    refusal: (c) => {
      if (circleChoices.some((x) => x.id === c.id)) return null;
      if (gov && isRootCircle(c)) return "A meeting can't be held citywide";
      if (gov && !circleCanHoldMeetings(c)) return "Its members haven't turned on meetings";
      return "You're not a member";
    },
    you,
  });
  const hostExplorer = useFederationExplorer({
    title: "Hosted by",
    circles: explorable,
    value: hostCircleId || null,
    onChange: setHostCircleId,
    refusal: (c) => {
      if (hostChoices.some((x) => x.id === c.id)) return null;
      if (isRootCircle(c)) return "The city can't host an event";
      if (!isCircleMember(c, profile.id)) return "You're not a member";
      return `It can't host an event shown to ${circle?.name ?? "this circle"}`;
    },
    you,
  });
  const explorerView = circleExplorer.view ?? hostExplorer.view;

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
    (remindersSet && !sameReminders(reminders, initialValues.reminders)) ||
    (gov && JSON.stringify(agenda) !== JSON.stringify(initialValues.agenda)) ||
    repeat !== "" ||
    until !== "";

  // picking a different circle to show it to can leave the chosen host outside
  // it, so drop back to hosting it yourself
  function pickCircle(id: string) {
    setCircleId(id);
    const host = hostCircleId ? byId[hostCircleId] : undefined;
    if (host && !hostCanShowTo(host, id, parentOf)) setHostCircleId("");
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
  function openView(next: "slots" | "agenda" | "reminders") {
    setViewStart({ slots, agenda, reminders: chosen, remindersSet });
    // a blank one to type into, if there's none yet
    if (next === "slots" && slots.length === 0) setSlots([{ ...BLANK_SLOT }]);
    setView(next);
  }
  function closeView() {
    // slots nobody named are just dropped
    if (view === "slots") setSlots(slots.filter((x) => x.label.trim()));
    setView("form");
    setViewStart(null);
  }
  function discardView() {
    if (viewStart) {
      setSlots(viewStart.slots);
      setAgenda(viewStart.agenda);
      setReminders(viewStart.reminders);
      setRemindersSet(viewStart.remindersSet);
    }
    setConfirmingViewDiscard(false);
    setView("form");
    setViewStart(null);
  }
  // changed since the view opened (a blank slot it added to type into doesn't count)
  const named = (xs: SlotDraft[]) => xs.filter((x) => x.label.trim());
  const viewDirty =
    !!viewStart &&
    (view === "agenda"
      ? JSON.stringify(agenda) !== JSON.stringify(viewStart.agenda)
      : view === "reminders"
        ? !sameReminders(chosen, viewStart.reminders)
        : view === "slots" && JSON.stringify(named(slots)) !== JSON.stringify(named(viewStart.slots)));

  // leaving is the top bar's Back, which asks before discarding changes; from
  // a view within the form it goes back to the form without that view's
  // changes (Done is what keeps them), asking first if there are any
  useBackHandler(circleExplorer.backHandler ?? hostExplorer.backHandler ?? (view !== "form" ? (viewDirty ? () => setConfirmingViewDiscard(true) : discardView) : dirty ? () => setConfirmingDiscard(true) : null));

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
      // a new event's that can't come any more are left off; an edited one's
      // are kept, since the server counts any already past as done
      reminders: mode === "create" ? chosen.filter((h) => available.includes(h)) : chosen,
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

  const submitLabel = mode === "edit" ? "Save changes" : (gov ? (approverRole ? "Schedule meeting" : "Propose meeting") : hostCircle ? "Propose event" : "Create event");
  // a new meeting or circle-hosted event that needs its circle's consent is
  // proposed, not saved: the orange Propose button with the proposals' hand,
  // as on Manage circle's Details and Roles (an undecided one can't be edited)
  const proposingNew = proposing && mode === "create";
  // the agenda's Done waits until every topic in it has one: a new, blank one
  // is filled in or removed first (Back still leaves; the form then says what's missing)
  const agendaComplete = agenda.every((a) => a.title.trim());
  useTopBarAction(
    circleExplorer.topBarAction ?? hostExplorer.topBarAction ?? (view !== "form"
      ? {
          label: "Done",
          icon: CheckIcon,
          onAction: closeView,
          // nothing to keep until something's changed (Back leaves), and the
          // agenda not until every topic in it has a title
          disabled: !viewDirty || (view === "agenda" && !agendaComplete),
          variant: "primary",
        }
      : proposingNew
        ? { label: busy ? "Saving" : submitLabel, icon: HandRaisedIcon, onAction: () => setConfirmingProposal(true), disabled: !canSubmit, variant: "propose" }
        : { label: busy ? "Saving" : submitLabel, icon: CheckIcon, onAction: submit, disabled: !canSubmit, variant: "primary" })
  );
  // proposing sends it to the deciding circle's members at once, so it's
  // asked first, saying who'll be asked and how it's decided
  const decidingCircle = hostCircle ?? meetingCircle;
  const deciders = decidingCircle?.members.filter((m) => m !== profile.id).length ?? 0;

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
    <FederationExplorerField id="circle" circles={mode === "edit" ? circles : explorable} value={circleId || null} onOpen={circleExplorer.open} disabled={mode === "edit"} />
  );

  const topics = agenda.filter((a) => a.title.trim());
  const roleNames = slots.filter((x) => x.label.trim()).map((x) => x.label.trim());

  // Back from a view with changes in it: Done keeps them, this drops them
  const viewDiscardModal = confirmingViewDiscard && (
    <ConfirmModal
      title="Discard changes?"
      message={`Your changes to the ${view === "agenda" ? "agenda" : view === "reminders" ? "reminders" : "roles"} won't be kept. Tap Done to keep them.`}
      confirmLabel="Discard"
      cancelLabel="Cancel"
      onConfirm={discardView}
      onCancel={() => setConfirmingViewDiscard(false)}
    />
  );

  if (explorerView) return explorerView;

  if (view === "slots") {
    return (
      <PageContainer size="compact">
        <h2 className="font-sans text-xl font-extrabold tracking-heading">Roles</h2>
        <p className="mt-2 mb-5 font-serif text-sm leading-normal text-soft">
          People sign up for these, like shift lead or greeter. Roles replace the normal RSVP. Leave none to keep it a simple RSVP.
        </p>
        <SlotsEditor slots={slots} onChange={setSlots} />
        {viewDiscardModal}
      </PageContainer>
    );
  }

  if (view === "reminders") {
    return (
      <PageContainer size="compact">
        <h2 className="font-sans text-xl font-extrabold tracking-heading">Reminders</h2>
        <p className="mt-2 mb-5 font-serif text-sm leading-normal text-soft">
          When to remind everyone going, by email and push. Something that needs setting up, or a shift, may want a day&rsquo;s notice; something casual, just the hour before.
        </p>
        <SettingRows>
          {REMINDERS.map((r) => {
            const open = available.includes(r.hours);
            return (
              <SettingRow
                key={r.hours}
                label={r.label}
                {...(open ? {} : { detail: `It starts in less than ${r.hours === 24 ? "a day" : r.hours === 2 ? "2 hours" : "an hour"}.` })}
                checked={open && chosen.includes(r.hours)}
                disabled={!open}
                onChange={(on) => {
                  setReminders(on ? [...chosen, r.hours] : chosen.filter((h) => h !== r.hours));
                  setRemindersSet(true);
                }}
              />
            );
          })}
        </SettingRows>
        {viewDiscardModal}
      </PageContainer>
    );
  }

  if (view === "agenda") {
    return (
      <PageContainer size="compact">
        <h2 className="font-sans text-xl font-extrabold tracking-heading">Agenda</h2>
        <p className="mt-2 mb-5 font-serif text-sm leading-normal text-soft">
          Mark each topic with what the circle will do with it: hear a report, explore it together, or decide it.
        </p>
        <AgendaEditor items={agenda} onChange={setAgenda} />
        {viewDiscardModal}
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
                  "ink-press relative flex cursor-pointer flex-col items-stretch justify-start border bg-paper px-4 py-4 text-left",
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
            <p className="mt-3 border-l-[3px] border-leaf pl-3 font-serif text-sm leading-normal text-body">
              As {circle.name}&apos;s <strong>{approverRole}</strong>, you schedule it directly, without asking for consent, and {circle.type === "neighborhood" ? "residents" : "members"} RSVP as they would to any event.
            </p>
          )}
          {circle && !approverRole && (
            <p className="mt-3 border-l-[3px] border-flame pl-3 font-serif text-sm leading-normal text-body">
              This is a proposal to {circle.name}. It&apos;s scheduled once its {circle.type === "neighborhood" ? "residents" : "members"} consent, or after 3 days if no one objects. Until then it&apos;s in no list. You and everyone who consents are marked as going.
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
          <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-4 min-[720px]:col-span-2">
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

          {gov && circleId && <MeetingAvailability circleId={circleId} date={date} start={start} end={end} eventId={event?.id} />}

          {mode === "create" ? (!gov && (
            <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
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
                  {hostCircle
                    ? `${hostCircle.name} decides once, on the first date: consenting to it schedules them all.`
                    : "Members are told once, when it's created."}
                </p>
              )}
            </div>
          )) : series && (
            <div>
              <Label htmlFor="scope">Repeats</Label>
              <p className="mb-3 font-serif text-base">{repeatSummary(series)}</p>
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
                  While it&apos;s waiting on its circle&apos;s consent, changes apply to the whole series.
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
          <MenuRow onClick={() => openView("reminders")} icon={BellAlertIcon} label="Reminders" detail={remindersSummary(chosen.filter((h) => available.includes(h)))} />
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
              <div className="flex items-center gap-3 border border-ink bg-paper px-3 py-3">
                <Avatar member={profile} size={26} />
                <span className="font-sans text-sm font-bold">{profile.name} (you)</span>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="host">Hosted by</Label>
              <FederationExplorerField id="host" circles={mode === "edit" ? circles : explorable} value={hostCircleId || null} onOpen={hostExplorer.open} placeholder={`${profile.name} (you)`} disabled={mode === "edit"} />
              {hostCircleId && mode !== "edit" && (
                <button type="button" onClick={() => setHostCircleId("")} className="hit relative mt-2 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-semibold text-soft underline underline-offset-2">
                  Host it yourself instead
                </button>
              )}
              {hostCircle && circle && (
                <p className="mt-1.5 font-serif text-sm leading-[1.45] text-soft">
                  {mode === "edit"
                    ? `Hosted by ${hostCircle.name}, so it can't be re-hosted once proposed.`
                    : `This is a proposal to ${hostCircle.name}. It's scheduled once its members consent, or after 3 days if no one objects; until then only they can see it, ${hasRoles ? "and its roles can be taken once it's scheduled" : "and you and everyone who consents are marked as going"}. Once it's scheduled it opens to ${circleIsPrivate(hostCircle) ? "the group" : audienceLabel(circle)}, and any member of ${hostCircle.name} can edit or cancel it.`}
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
        <div className="mt-8 border-t border-ink pt-6">
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

      {circleExplorer.dialog}
      {hostExplorer.dialog}
      {confirmingProposal && decidingCircle && (
        <ConfirmModal
          title={`Propose this ${noun}?`}
          message={deciders === 0
            ? `You're ${decidingCircle.name}'s only member, so it'll be scheduled straight away.`
            : hostCircle
              ? `It's hosted by ${decidingCircle.name}, so it needs the consent of its members.`
              : `It's ${decidingCircle.name}'s meeting, so it needs the consent of its members.`}
          confirmLabel={`Propose ${noun}`}
          cancelLabel="Not yet"
          tone="flame"
          onConfirm={() => { setConfirmingProposal(false); void submit(); }}
          onCancel={() => setConfirmingProposal(false)}
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
