"use client";

import { useState } from "react";
import { BackButton, Button, Eyebrow, Input, Label, TextArea } from "@/components/shared";
import { COUNCIL_RATIFY_THRESHOLD } from "@/lib/data";
import type { Event, ProposalDetails } from "@/lib/types";

interface GovernanceProposalFormPageProps {
  mode: "council" | "assembly";
  context: Event;
  hood?: string;
  sponsorHood?: string;
  onSubmit: (details: ProposalDetails) => void;
  onCancel: () => void;
}

/* A focused form for proposing a federation council (from a confirmed
   meeting) or an endorsing meeting (from a council). Collects title, date,
   time, location, and agenda — mirroring the meeting event form. */
export function GovernanceProposalFormPage({ mode, context, hood, sponsorHood, onSubmit, onCancel }: GovernanceProposalFormPageProps) {
  const isCouncil = mode === "council";
  const [title, setTitle] = useState(isCouncil ? "Providence Federation Council" : `${hood} Neighborhood Council Meeting`);
  const [date, setDate] = useState("");
  const [start, setStart] = useState(isCouncil ? "16:00" : "18:30");
  const [end, setEnd] = useState(isCouncil ? "19:00" : "20:30");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!title.trim()) return setError("Give the meeting a title.");
    if (!date) return setError("Pick a date.");
    if (!location.trim()) return setError("Add a location.");
    onSubmit({ title: title.trim(), date, start, end, location: location.trim(), agenda: agenda.trim() || "Agenda to be set." });
  }

  return (
    <div className="mx-auto max-w-160 px-6 pt-7 pb-20">
      <BackButton onClick={onCancel}>Cancel</BackButton>

      <div className="mt-4 border-t-[3px] border-t-flame border-b border-b-ink pt-4 pb-5">
        <Eyebrow className="text-flame">{isCouncil ? "Propose a federation council meeting" : `Propose a ${hood} meeting`}</Eyebrow>
        <h1 className="mt-3 font-sans text-heading leading-none font-extrabold tracking-tight">
          {isCouncil ? "New meeting proposal" : "New meeting"}
        </h1>
        <p className="mt-3 max-w-[42em] font-serif text-sm leading-normal text-soft">
          {isCouncil
            ? `As a delegate of ${sponsorHood}, draft the federation council meeting for your meeting to ratify. Once ${COUNCIL_RATIFY_THRESHOLD} attendees vote to ratify, it becomes a proposed federation council meeting.`
            : `Propose a meeting in ${hood} to decide whether to endorse "${context.title}". If your meeting passes its vote, ${hood} endorses the federation council meeting.`}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-5.5">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3.5">
          <div className="grow basis-40">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grow basis-25">
            <Label htmlFor="start">Start</Label>
            <Input id="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grow basis-25">
            <Label htmlFor="end">End</Label>
            <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where will it be held?" />
        </div>
        <div>
          <Label htmlFor="agenda">Agenda</Label>
          <TextArea id="agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={4} placeholder="What's on the agenda?" />
        </div>

        {error && <p className="font-sans text-xs text-danger">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <Button accent="flame" onClick={submit}>
            {isCouncil ? "Post proposal" : "Propose meeting"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
