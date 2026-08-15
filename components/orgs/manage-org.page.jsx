"use client";

import { useState } from "react";
import clsx from "clsx";
import { BackButton } from "@/components/chrome/back-button";
import { ConfirmModal } from "@/components/chrome/confirm-modal";
import { fieldInput, fieldLabel } from "@/components/chrome/form-fields";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { EditableTags } from "@/components/profile/editable-tags";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

// matches org.page.jsx's read-only facts grid (label above a bold value,
// evenly split columns) — kept fixed at 4 slots since that's what the
// reference display grid assumes today.
const FACT_SLOTS = 4;

export function ManageOrgPage({ org: o, onSave, onBack }) {
  const [about, setAbout] = useState(o.about);
  const [offers, setOffers] = useState([...o.offers]);
  const [facts, setFacts] = useState(() =>
    Array.from({ length: FACT_SLOTS }, (_, i) => {
      const [label, value] = o.facts[i] || ["", ""];
      return { label, value };
    })
  );
  // blank slots (no label and no value) are dropped rather than saved as
  // empty facts — this also lets an org end up with fewer than 4 facts,
  // which org.page.jsx's display grid already handles (it sizes its
  // columns from facts.length rather than assuming 4).
  const factPairs = facts.map((f) => [f.label.trim(), f.value.trim()]).filter(([label, value]) => label || value);
  const dirty = about !== o.about || offers.join("\u0000") !== o.offers.join("\u0000") || JSON.stringify(factPairs) !== JSON.stringify(o.facts);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function updateFact(i, key, value) {
    setFacts((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: value } : f)));
  }

  function handleSave() {
    onSave({ about: about.trim(), offers, facts: factPairs });
    onBack();
  }

  // shared by the top BackButton and the bottom Cancel button — both leave
  // the form the same way, so both need the same unsaved-changes guard.
  function handleLeave() {
    if (dirty) setConfirmingDiscard(true);
    else onBack();
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
      <BackButton onClick={handleLeave}>{o.name}</BackButton>

      <div style={{ borderTop: `3px solid ${INK}`, borderBottom: `1px solid ${INK}`, marginTop: 16, paddingTop: 16, paddingBottom: 20 }}>
        <Eyebrow style={{ color: SOFT }}>Manage organization</Eyebrow>
        <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.title, letterSpacing: "-0.035em", lineHeight: 0.95, margin: "12px 0 0" }}>{o.name}</h1>
        <p style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT, margin: "12px 0 0", lineHeight: 1.5, maxWidth: "42em" }}>
          You’re editing this page as a member. Changes are visible to everyone, and your name will show as the last editor.
        </p>
      </div>

      <section className="border-b border-faint py-6.5">
        <label style={fieldLabel}>Quick facts</label>
        <div className="mt-2.5 grid grid-cols-1 min-[720px]:grid-cols-4 border border-ink">
          {facts.map((f, i) => (
            <div
              key={i}
              className={clsx(
                "p-3.5",
                i < facts.length - 1 && "border-b min-[720px]:border-b-0 min-[720px]:border-r border-faint",
              )}
            >
              <input
                value={f.label}
                onChange={(e) => updateFact(i, "label", e.target.value)}
                placeholder="Label"
                className="w-full border border-faint bg-paper px-2 py-1.5 font-sans text-micro font-bold uppercase tracking-[0.15em] text-soft outline-none focus:border-ink"
              />
              <input
                value={f.value}
                onChange={(e) => updateFact(i, "value", e.target.value)}
                placeholder="Value"
                className="mt-2 w-full border border-faint bg-paper px-2 py-1.5 font-sans text-lg font-extrabold tracking-tight text-ink outline-none focus:border-ink"
              />
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>About</label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Write a short description of your organization, its purpose, and what it does."
          rows={5}
          style={{ ...fieldInput, resize: "vertical", lineHeight: 1.5 }}
        />
      </section>

      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <label style={fieldLabel}>What we offer</label>
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
          onClick={handleLeave}
          className="ink-press"
          style={{
            fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            cursor: "pointer", padding: "13px 24px", border: `1px solid ${INK}`, background: PAPER, color: INK,
          }}
        >
          Cancel
        </button>
      </div>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to this organization. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  );
}
