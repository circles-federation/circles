"use client";

import { useState } from "react";
import { EyeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { BackButton } from "@/components/chrome/back-button";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { fieldInput, fieldLabel } from "@/components/chrome/form-fields";
import { EditableTags } from "./editable-tags";
import { useIsMobile } from "@/lib/hooks";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* Edit Myself — the editing form, reached from the Myself page's Edit button.
   Saves back to the profile and returns to the view. */
export function EditMyselfPage({ profile, onSave, onBack }) {
  const [draft, setDraft] = useState({ ...profile, skills: [...profile.skills], interests: [...profile.interests] });
  const set = (patch) => setDraft((p) => ({ ...p, ...patch }));
  const isMobile = useIsMobile();

  function handleSave() {
    onSave(draft);
    onBack();
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={onBack}>Home</BackButton>

      <div style={{ borderTop: `3px solid ${INK}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 16, paddingBottom: 18 }}>
        <Eyebrow style={{ color: SOFT }}>Edit</Eyebrow>
        <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.heading, letterSpacing: "-0.03em", lineHeight: 1, margin: "12px 0 0" }}>Edit my details</h1>
      </div>

      {/* bio */}
      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>Bio</label>
        <textarea value={draft.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} style={{ ...fieldInput, resize: "vertical", lineHeight: 1.5 }} />
      </section>

      {/* email + visibility */}
      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>Email</label>
        <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${INK}` }}>
          <input
            value={draft.email || ""}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="you@duck.com"
            style={{ flex: 1, minWidth: 0, padding: "11px 12px", border: "none", fontFamily: serif, fontSize: TYPE.base, background: PAPER, outline: "none" }}
          />
          <div style={{ display: "flex", alignItems: "stretch", borderLeft: `1px solid ${INK}` }}>
            <button
              onClick={() => set({ emailPublic: true })}
              className="ink-press"
              title="Visible to neighbors"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none",
                borderRight: `1px solid ${INK}`, padding: "0 14px", whiteSpace: "nowrap",
                background: draft.emailPublic ? INK : PAPER, color: draft.emailPublic ? PAPER : INK,
                fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700,
              }}
            >
              <EyeIcon className="size-3.5" strokeWidth={2.5} />{!isMobile && " Visible"}
            </button>
            <button
              onClick={() => set({ emailPublic: false })}
              className="ink-press"
              title="Hidden from other members"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none",
                padding: "0 14px", whiteSpace: "nowrap",
                background: !draft.emailPublic ? INK : PAPER, color: !draft.emailPublic ? PAPER : INK,
                fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700,
              }}
            >
              <LockClosedIcon className="size-3.5" strokeWidth={2.5} />{!isMobile && " Hidden"}
            </button>
          </div>
        </div>
        <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "10px 0 0", lineHeight: 1.5 }}>
          {draft.emailPublic
            ? "Your email is shown here so neighbors can reach you directly."
            : "Your email is private. Neighbors won't see a way to email you."}
        </p>
      </section>

      {/* skills */}
      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>Skills I offer</label>
        <EditableTags values={draft.skills} onChange={(v) => set({ skills: v })} placeholder="Add a skill and press Enter" />
      </section>

      {/* interests */}
      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>Interests</label>
        <EditableTags values={draft.interests} onChange={(v) => set({ interests: v })} placeholder="Add an interest and press Enter" />
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          className="btn-invert btn-ink"
          style={{
            fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            cursor: "pointer", padding: "13px 24px", border: `1px solid ${INK}`, background: INK, color: PAPER,
          }}
        >
          Save changes
        </button>
        <button
          onClick={onBack}
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
  );
}
