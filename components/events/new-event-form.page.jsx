"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { BackButton } from "@/components/chrome/back-button";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { fieldInput, fieldLabel } from "@/components/chrome/form-fields";
import { TabbedPanel } from "@/components/chrome/tabbed-panel";
import { CURRENT_USER_ID, EVENT_KINDS, ORGS_BY_MEMBER, avatarFor, memberById } from "@/lib/data";
import { useIsMobile } from "@/lib/hooks";
import { FAINT, FLAME, INK, PAPER, PLUM, SOFT, TYPE, sans, serif } from "@/lib/theme";

export function NewEventForm({ onCreate, onCancel }) {
  const isMobile = useIsMobile();
  // host options: the current user, plus every org they belong to
  const me = memberById(CURRENT_USER_ID);
  const myOrgs = ORGS_BY_MEMBER[CURRENT_USER_ID] || [];
  const hostOptions = [
    { key: "member:" + me.id, label: `${me.name} (you)`, host: { type: "member", id: me.id } },
    ...myOrgs.map((o) => ({ key: "org:" + o.id, label: o.name, host: { type: "org", id: o.id } })),
  ];

  const [type, setType] = useState("ordinary");
  const [title, setTitle] = useState("");
  const [hostKey, setHostKey] = useState(hostOptions[0].key);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [membersOnly, setMembersOnly] = useState(false);
  // slots (roles) for org-hosted events: each { label, description, min, max }
  const [useSlots, setUseSlots] = useState(false);
  const [slots, setSlots] = useState([{ label: "", description: "", min: "1", max: "" }]);
  const [error, setError] = useState("");

  const meta = EVENT_KINDS[type];
  const gov = meta.governance;
  const accent = gov ? FLAME : INK;

  function submit() {
    if (!title.trim()) return setError("Give the " + (gov ? "meeting" : "event") + " a title.");
    if (!date) return setError("Pick a date.");
    if (!location.trim()) return setError("Add a location.");
    if (gov) {
      // governance meetings are proposed by a person, not an org; the proposer is the first vote.
      // assemblies are scoped to the proposer's neighborhood; councils are federation-wide.
      const scope = me.neighborhood; // assemblies are scoped to the proposer's neighborhood
      onCreate({
        id: "e" + Date.now(),
        title: title.trim(),
        kind: type,
        scope,
        host: { type: "member", id: CURRENT_USER_ID },
        date, start, end,
        location: location.trim(),
        description: description.trim() || "No agenda yet.",
        votes: [CURRENT_USER_ID],
        rsvps: [CURRENT_USER_ID],
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
      rsvps: roles ? [] : [CURRENT_USER_ID],
      ...(roles ? { roles } : {}),
      ...(isOrgHost && membersOnly ? { membersOnly: true } : {}),
    });
  }

  const types = [
    ["ordinary", "Event"],
    ["assembly", "Assembly"],
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={onCancel}>All events</BackButton>

      <div style={{ borderTop: `3px solid ${accent}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 16, paddingBottom: 20 }}>
        <Eyebrow style={{ color: gov ? FLAME : SOFT }}>{gov ? "Propose" : "Create"}</Eyebrow>
        <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.title, letterSpacing: "-0.035em", lineHeight: 0.95, margin: "12px 0 0" }}>
          {type === "ordinary" ? "New event" : "Neighborhood assembly"}
        </h1>
      </div>

      {/* type selector — reusable tabbed panel wrapping the form fields */}
      <TabbedPanel
        tabs={types.map(([key, label]) => ({ key, label, accent: EVENT_KINDS[key].governance ? FLAME : INK }))}
        active={type}
        onChange={(key) => { setType(key); setError(""); }}
      >
      {gov && (
        <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: "#222", lineHeight: 1.5, margin: "0 0 4px", borderLeft: `3px solid ${FLAME}`, paddingLeft: 12 }}>
          {type === "assembly"
            ? <>This is a governance meeting for <strong>{me.neighborhood}</strong>. Once proposed it needs <strong>{meta.threshold} votes from {me.neighborhood} residents</strong> to be confirmed. Your proposal counts as the first vote.</>
            : <>This is a federation-wide governance meeting. Once proposed it needs <strong>{meta.threshold} votes</strong> from across the federation to be confirmed. Your proposal counts as the first vote.</>}
        </p>
      )}

      <div style={{ paddingTop: gov ? 22 : 0, display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <label style={fieldLabel}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={gov ? "What is this meeting about?" : "What's happening?"} style={fieldInput} />
        </div>

        {!gov && (
          <div>
            <label style={fieldLabel}>Hosted by</label>
            <div style={{ position: "relative" }}>
              <select value={hostKey} onChange={(e) => setHostKey(e.target.value)} style={{ ...fieldInput, cursor: "pointer", appearance: "none", borderRadius: 0, paddingRight: 36 }}>
                {hostOptions.map((h) => (
                  <option key={h.key} value={h.key}>{h.label}</option>
                ))}
              </select>
              <ChevronDownIcon
                className="size-4"
                strokeWidth={2}
                style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", color: SOFT, pointerEvents: "none" }}
              />
            </div>
            {hostKey.startsWith("org:") && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 14, cursor: "pointer", padding: "12px 14px", border: `1px solid ${membersOnly ? PLUM : FAINT}`, background: membersOnly ? "rgba(106,61,154,0.06)" : PAPER }}>
                <input
                  type="checkbox"
                  checked={membersOnly}
                  onChange={(e) => setMembersOnly(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: PLUM, flexShrink: 0, cursor: "pointer" }}
                />
                <span>
                  <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm, color: membersOnly ? PLUM : INK }}>Members only</span>
                  <span style={{ display: "block", fontFamily: serif, fontSize: TYPE.sm, color: SOFT, lineHeight: 1.45, marginTop: 3 }}>
                    Everyone can see this event, but only members of {hostOptions.find((h) => h.key === hostKey).label} can RSVP and are emailed about it.
                  </span>
                </span>
              </label>
            )}
            {hostKey.startsWith("org:") && (
              <div style={{ marginTop: 14, border: `1px solid ${useSlots ? INK : FAINT}`, padding: "14px 16px" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={useSlots}
                    onChange={(e) => setUseSlots(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 1, accentColor: INK, flexShrink: 0, cursor: "pointer" }}
                  />
                  <span>
                    <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm }}>Use slots</span>
                    <span style={{ display: "block", fontFamily: serif, fontSize: TYPE.sm, color: SOFT, lineHeight: 1.45, marginTop: 3 }}>
                      Define named roles people sign up for (like shift lead, greeter). Slots replace the normal RSVP.
                    </span>
                  </span>
                </label>

                {useSlots && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    {slots.map((s, i) => (
                      <div key={i} style={{ border: `1px solid ${FAINT}`, padding: "14px 14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.eyebrow, letterSpacing: "0.08em", textTransform: "uppercase", color: SOFT }}>Slot {i + 1}</span>
                          {slots.length > 1 && (
                            <button
                              onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: SOFT, fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, padding: 0 }}
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                        <input
                          value={s.label}
                          onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                          placeholder="Slot name (e.g. Shift lead)"
                          style={{ ...fieldInput, marginBottom: 10 }}
                        />
                        <input
                          value={s.description}
                          onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                          placeholder="Description (optional)"
                          style={{ ...fieldInput, marginBottom: 10 }}
                        />
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={fieldLabel}>Min</label>
                            <input
                              type="number" min="0"
                              value={s.min}
                              onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, min: e.target.value } : x))}
                              style={{ ...fieldInput, fontFamily: sans, fontSize: TYPE.sm }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={fieldLabel}>Max (optional)</label>
                            <input
                              type="number" min="1"
                              value={s.max}
                              onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, max: e.target.value } : x))}
                              placeholder="No limit"
                              style={{ ...fieldInput, fontFamily: sans, fontSize: TYPE.sm }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setSlots([...slots, { label: "", description: "", min: "1", max: "" }])}
                      className="ink-press"
                      style={{
                        fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                        cursor: "pointer", padding: "10px 15px", alignSelf: "flex-start",
                        border: `1px solid ${INK}`, background: PAPER, color: INK,
                      }}
                    >
                      + Add slot
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {gov && (
          <div>
            <label style={fieldLabel}>Proposed by</label>
            <div style={{ ...fieldInput, display: "flex", alignItems: "center", gap: 10 }}>
              <img src={avatarFor(me)} alt="" style={{ width: 26, height: 26, objectFit: "cover", border: `1px solid ${INK}` }} />
              <span style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.sm }}>{me.name} (you)</span>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={fieldLabel}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...fieldInput, fontFamily: sans, fontSize: TYPE.sm }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, gridColumn: isMobile ? "auto" : "span 2" }}>
            <div>
              <label style={fieldLabel}>Start</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...fieldInput, fontFamily: sans, fontSize: TYPE.sm }} />
            </div>
            <div>
              <label style={fieldLabel}>End</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...fieldInput, fontFamily: sans, fontSize: TYPE.sm }} />
            </div>
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where should people go?" style={fieldInput} />
        </div>

        <div>
          <label style={fieldLabel}>{gov ? "Agenda" : "Description"}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder={gov ? "What should this meeting decide or discuss?" : "What's it about, what to bring, who it's for…"} style={{ ...fieldInput, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {error && (
          <div style={{ fontFamily: sans, fontSize: TYPE.xs, fontWeight: 600, color: accent, borderLeft: `3px solid ${accent}`, paddingLeft: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: `1px solid ${INK}`, paddingTop: 22 }}>
          <button
            onClick={submit}
            className={clsx("btn-invert", gov ? "btn-flame" : "btn-ink")}
            style={{
              fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.14em", textTransform: "uppercase",
              fontWeight: 700, background: accent, color: PAPER, border: `1px solid ${accent}`,
              padding: "14px 28px", cursor: "pointer",
            }}
          >
            {gov ? "Propose meeting" : "Create event"}
          </button>
          <button
            onClick={onCancel}
            className="ink-press"
            style={{
              fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.14em", textTransform: "uppercase",
              fontWeight: 700, background: PAPER, color: INK, border: `1px solid ${INK}`,
              padding: "14px 24px", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
      </TabbedPanel>
    </div>
  );
}
