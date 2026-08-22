"use client";

import { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { BackButton } from "@/components/chrome/back-button";
import { Button } from "@/components/chrome/button";
import { ConfirmModal } from "@/components/chrome/confirm-modal";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { Input } from "@/components/chrome/input";
import { Label } from "@/components/chrome/label";
import { Select } from "@/components/chrome/select";
import { TextArea } from "@/components/chrome/text-area";
import { EditableTags } from "@/components/profile/editable-tags";
import { MEMBERS } from "@/lib/data";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

// matches org.page.jsx's read-only facts grid (label above a bold value,
// evenly split columns) — kept fixed at 4 slots since that's what the
// reference display grid assumes today.
const FACT_SLOTS = 4;

// neighborhoods first (sorted), then Providence (the federation level) last
// — same derivation/ordering as org-directory.page.jsx's "Level" filter.
const SCOPE_OPTIONS = [...new Set(MEMBERS.map((m) => m.neighborhood))].sort().concat("Providence");

export function ManageOrgPage({ org: o, onSave, onBack }) {
  const [level, setLevel] = useState(o.level);
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
  const [website, setWebsite] = useState(o.website || "");
  const [address, setAddress] = useState(o.address || "");
  const [hours, setHours] = useState(() => (o.hours || []).map(([day, time]) => ({ day, time })));
  // same drop-blank-rows treatment as facts, letting an org end up with
  // fewer (or zero) hours rows than it started with.
  const hoursPairs = hours.map((h) => [h.day.trim(), h.time.trim()]).filter(([day, time]) => day || time);
  const dirty =
    level !== o.level ||
    about !== o.about ||
    offers.join("\u0000") !== o.offers.join("\u0000") ||
    JSON.stringify(factPairs) !== JSON.stringify(o.facts) ||
    website.trim() !== (o.website || "") ||
    address.trim() !== (o.address || "") ||
    JSON.stringify(hoursPairs) !== JSON.stringify(o.hours || []);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function updateFact(i, key, value) {
    setFacts((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: value } : f)));
  }

  function updateHour(i, key, value) {
    setHours((prev) => prev.map((h, j) => (j === i ? { ...h, [key]: value } : h)));
  }

  function addHourRow() {
    setHours((prev) => [...prev, { day: "", time: "" }]);
  }

  function removeHourRow(i) {
    setHours((prev) => prev.filter((_, j) => j !== i));
  }

  function handleSave() {
    onSave({ level, about: about.trim(), offers, facts: factPairs, website: website.trim(), address: address.trim(), hours: hoursPairs });
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
        <Label htmlFor="org-scope">Scope</Label>
        <Select id="org-scope" value={level} onChange={(e) => setLevel(e.target.value)} className="max-w-90">
          {SCOPE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
          Choosing a neighborhood limits visibility to existing members and residents of that neighborhood. Choosing Providence makes the organization visible federation-wide.
        </p>
      </section>

      <section className="border-b border-faint py-6.5">
        <Label>Quick facts</Label>
        <div className="grid grid-cols-1 min-[720px]:grid-cols-4 border border-ink">
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
        <Label>About</Label>
        <TextArea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Write a short description of your organization, its purpose, and what it does."
          rows={5}
        />
      </section>

      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <Label>What we offer</Label>
        <EditableTags values={offers} onChange={setOffers} placeholder="Add an offering and press Enter" />
      </section>

      <section style={{ padding: "26px 0", borderBottom: `1px solid ${FAINT}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <Label>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="yourorg.coop"
            />
          </div>

          <div>
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Providence, RI"
            />
          </div>

          <div>
            <Label>Open hours</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hours.map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "stretch", border: `1px solid ${INK}` }}>
                  <input
                    value={h.day}
                    onChange={(e) => updateHour(i, "day", e.target.value)}
                    placeholder="Day (e.g. Tue or Mon–Fri)"
                    style={{ flex: 1, minWidth: 0, padding: "11px 12px", border: "none", borderRight: `1px solid ${INK}`, fontFamily: serif, fontSize: TYPE.base, outline: "none" }}
                  />
                  <input
                    value={h.time}
                    onChange={(e) => updateHour(i, "time", e.target.value)}
                    placeholder="Hours (e.g. 4–8pm)"
                    style={{ flex: 1, minWidth: 0, padding: "11px 12px", border: "none", borderRight: `1px solid ${INK}`, fontFamily: serif, fontSize: TYPE.base, outline: "none" }}
                  />
                  <button
                    onClick={() => removeHourRow(i)}
                    aria-label="Remove"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", background: PAPER, color: SOFT, padding: "0 14px", flexShrink: 0 }}
                  >
                    <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              <Button variant="secondary" size="compact" onClick={addHourRow} className="self-start">
                <PlusIcon className="size-3.5" strokeWidth={2.5} />
                Add hours
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <Button onClick={handleSave} disabled={!dirty}>Save changes</Button>
        <Button variant="secondary" onClick={handleLeave}>Cancel</Button>
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
