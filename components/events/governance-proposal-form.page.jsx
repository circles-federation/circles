"use client";

import { useState } from "react";
import { BackButton, Eyebrow, fieldInput, fieldLabel } from "@/components/shared";
import { COUNCIL_RATIFY_THRESHOLD } from "@/lib/data";
import { FLAME, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* A focused form for proposing a federation council (from an assembly) or an
   endorsing neighborhood assembly (from a council). Collects title, date, time,
   location, and agenda — mirroring the assembly event form. */
export function GovernanceProposalForm({ mode, context, hood, onSubmit, onCancel }) {
  const isCouncil = mode === "council";
  const [title, setTitle] = useState(isCouncil ? "Providence Federation Council" : `${hood} Neighborhood Assembly`);
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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={onCancel}>Cancel</BackButton>

      <div style={{ borderTop: `3px solid ${FLAME}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 16, paddingBottom: 20 }}>
        <Eyebrow style={{ color: FLAME }}>{isCouncil ? "Propose a federation council meeting" : `Propose a ${hood} assembly`}</Eyebrow>
        <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.heading, letterSpacing: "-0.03em", lineHeight: 1, margin: "12px 0 0" }}>
          {isCouncil ? "New meeting proposal" : "New assembly"}
        </h1>
        <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "12px 0 0", lineHeight: 1.5, maxWidth: "42em" }}>
          {isCouncil
            ? `As a delegate of ${context.scope}, draft the federation council meeting for your assembly to ratify. Once ${COUNCIL_RATIFY_THRESHOLD} attendees vote to ratify, it becomes a proposed federation council meeting.`
            : `Propose an assembly in ${hood} to decide whether to endorse "${context.title}". If your assembly passes its vote, ${hood} endorses the federation council meeting.`}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 24 }}>
        <div>
          <label style={fieldLabel}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldInput} />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <label style={fieldLabel}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInput} />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={fieldLabel}>Start</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldInput} />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={fieldLabel}>End</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldInput} />
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where will it be held?" style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Agenda</label>
          <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={4} placeholder="What's on the agenda?" style={{ ...fieldInput, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {error && <p style={{ fontFamily: sans, fontSize: TYPE.xs, color: "#c0392b", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={submit}
            className="btn-invert btn-flame"
            style={{
              fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              cursor: "pointer", padding: "13px 24px", border: `1px solid ${FLAME}`, background: FLAME, color: PAPER,
            }}
          >
            {isCouncil ? "Post proposal" : "Propose assembly"}
          </button>
          <button
            onClick={onCancel}
            className="ink-press"
            style={{
              fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              cursor: "pointer", padding: "13px 24px", border: `1px solid ${INK}`, background: PAPER, color: INK,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
