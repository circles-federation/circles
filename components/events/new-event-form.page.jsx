"use client";

import { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, BackButton, Button, ConfirmModal, Eyebrow, Input, Label, Select, TabbedPanel, TextArea } from "@/components/shared";
import { EVENT_KINDS, MEMBERS, ORGS_BY_MEMBER } from "@/lib/data";
import { orgMembers } from "@/lib/orgs.util";

const DEFAULT_START = "18:00";
const DEFAULT_END = "20:00";
const DEFAULT_SLOTS = [{ label: "", description: "", min: "1", max: "" }];

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `border-t-${accent}`.
const ACCENT = {
  ink: { borderT: "border-t-ink", border: "border-ink", text: "text-ink" },
  flame: { borderT: "border-t-flame", border: "border-flame", text: "text-flame" },
};

export function NewEventFormPage({ profile, orgs, onCreate, onCancel }) {
  // host options: the current user, plus every org they belong to
  const myOrgs = ORGS_BY_MEMBER[profile.id] || [];
  const hostOptions = [
    { key: "member:" + profile.id, label: `${profile.name} (you)`, host: { type: "member", id: profile.id } },
    ...myOrgs.map((o) => ({ key: "org:" + o.id, label: o.name, host: { type: "org", id: o.id } })),
  ];
  // the proposer's own Neighborhood Council — meetings are always hosted by
  // it for now; no picker needed since a resident has exactly one (general
  // org-hosted meetings are future work, see lib/orgs.util.js)
  const myCouncil = orgs.find((o) => o.neighborhood === profile.neighborhood);
  const meetingThresholdPreview = myCouncil ? Math.floor(orgMembers(myCouncil, MEMBERS).length / 2) + 1 : 0;

  const [type, setType] = useState("ordinary");
  const [title, setTitle] = useState("");
  const [hostKey, setHostKey] = useState(hostOptions[0].key);
  const [date, setDate] = useState("");
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [membersOnly, setMembersOnly] = useState(false);
  // slots (roles) for org-hosted events: each { label, description, min, max }
  const [useSlots, setUseSlots] = useState(false);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [error, setError] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // true once the user has entered anything — guards Back/Cancel behind a
  // confirmation rather than tracking a "dirty" diff against saved data,
  // since a new-event form has no prior saved state to diff against.
  // Switching the Event/Meeting tab alone doesn't count: it's a selection,
  // not entered content, and it doesn't clear anything already typed.
  const dirty =
    title.trim() !== "" ||
    hostKey !== hostOptions[0].key ||
    date !== "" ||
    start !== DEFAULT_START ||
    end !== DEFAULT_END ||
    location.trim() !== "" ||
    description.trim() !== "" ||
    membersOnly ||
    useSlots ||
    JSON.stringify(slots) !== JSON.stringify(DEFAULT_SLOTS);

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
      // proposer is the first vote. A meeting is hosted by the proposer's
      // own Neighborhood Council (see myCouncil above).
      onCreate({
        id: "e" + Date.now(),
        title: title.trim(),
        kind: type,
        orgId: myCouncil ? myCouncil.id : null,
        host: { type: "member", id: profile.id },
        date, start, end,
        location: location.trim(),
        description: description.trim() || "No agenda yet.",
        votes: [profile.id],
        rsvps: [profile.id],
      });
      return;
    }
    const chosen = hostOptions.find((h) => h.key === hostKey);
    const isOrgHost = chosen.host.type === "org";

    // build slots (roles) if this is an org-hosted event using slots
    let roles = null;
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
        const role = {
          key: s.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("slot-" + i),
          label: s.label.trim(),
          description: s.description.trim(),
          min,
          members: [],
        };
        if (max != null) role.max = max;
        return role;
      });
    }

    onCreate({
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

  const types = [
    ["ordinary", "Event"],
    ["meeting", "Meeting"],
  ];

  return (
    <div className="mx-auto max-w-170 px-6 pt-7 pb-20">
      <BackButton onClick={handleLeave}>All events</BackButton>

      <div className={clsx("mt-4 border-t-[3px] border-b border-b-ink pt-4 pb-5", accent.borderT)}>
        <Eyebrow className={gov ? "text-flame" : "text-soft"}>{gov ? "Propose" : "Create"}</Eyebrow>
        <h1 className="mt-3 font-sans text-title font-extrabold tracking-[-0.035em] leading-[0.95]">
          {type === "ordinary" ? "New event" : "Neighborhood council meeting"}
        </h1>
      </div>

      {/* type selector — reusable tabbed panel wrapping the form fields */}
      <TabbedPanel
        tabs={types.map(([key, label]) => ({ key, label, variant: EVENT_KINDS[key].governance ? "flame" : "ink" }))}
        active={type}
        onChange={(key) => { setType(key); setError(""); }}
        className="mt-6"
      >
      {gov && (
        <p className="mb-1 border-l-[3px] border-flame pl-3 font-serif text-sm leading-normal text-[#222]">
          This is a governance meeting for <strong>{profile.neighborhood}</strong>. Once proposed it needs <strong>{meetingThresholdPreview} votes from {profile.neighborhood} residents</strong> to be confirmed. Your proposal counts as the first vote.
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
                    Everyone can see this event, but only members of {hostOptions.find((h) => h.key === hostKey).label} can RSVP and are emailed about it.
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
            {gov ? "Propose meeting" : "Create event"}
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
          message="You have unsaved changes to this event. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onCancel}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  );
}
