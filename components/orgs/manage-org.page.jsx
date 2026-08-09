"use client";

import { useState } from "react";
import { BackButton } from "@/components/chrome/back-button";
import { fieldInput, fieldLabel } from "@/components/chrome/form-fields";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { EditableTags } from "@/components/profile/editable-tags";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

export function ManageOrgPage({ org: o, onSave, onBack }) {
  const [about, setAbout] = useState(o.about);
  const [offers, setOffers] = useState([...o.offers]);
  const dirty = about !== o.about || offers.join("\u0000") !== o.offers.join("\u0000");

  function handleSave() {
    onSave({ about: about.trim(), offers });
    onBack();
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={onBack}>{o.name}</BackButton>

      <div style={{ borderTop: `3px solid ${INK}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 16, paddingBottom: 20 }}>
        <Eyebrow style={{ color: SOFT }}>Manage organization</Eyebrow>
        <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.title, letterSpacing: "-0.035em", lineHeight: 0.95, margin: "12px 0 0" }}>{o.name}</h1>
        <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "12px 0 0", lineHeight: 1.5, maxWidth: "42em" }}>
          You’re editing this page as a member. Changes are visible to everyone, and your name will show as the last editor.
        </p>
      </div>

      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>Bio</label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={5}
          style={{ ...fieldInput, resize: "vertical", lineHeight: 1.5 }}
        />
      </section>

      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>What they offer</label>
        <EditableTags values={offers} onChange={setOffers} placeholder="Add an offering and press Enter" />
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={dirty ? "btn-invert btn-ink" : undefined}
          style={{
            fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            cursor: dirty ? "pointer" : "not-allowed", padding: "13px 24px",
            border: `1px solid ${dirty ? INK : FAINT}`, background: dirty ? INK : PAPER, color: dirty ? PAPER : SOFT,
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
