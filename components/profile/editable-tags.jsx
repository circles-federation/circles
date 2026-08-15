"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/chrome/button";
import { fieldInput } from "@/components/chrome/form-fields";
import { INK, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* an editable list of tags: each removable, with an input to add new ones */
export function EditableTags({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {values.map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${INK}`, padding: "5px 8px 5px 11px", fontFamily: sans, fontSize: TYPE.eyebrow, fontWeight: 600 }}>
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: SOFT }}
            >
              <XMarkIcon className="size-3" strokeWidth={3} />
            </button>
          </span>
        ))}
        {values.length === 0 && <span style={{ fontFamily: serif, fontSize: TYPE.sm, color: SOFT }}>None yet.</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ ...fieldInput, flex: 1 }}
        />
        <Button variant="secondary" size="compact" disabled={!draft.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
