"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Input } from "@/components/shared";

interface EditableTagsProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

/* an editable list of tags: each removable, with an input to add new ones */
export function EditableTags({ values, onChange, placeholder }: EditableTagsProps) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.75 border border-ink py-1.25 pr-2 pl-2.75 font-sans text-eyebrow font-semibold">
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="inline-flex cursor-pointer border-none bg-transparent p-0 text-soft"
            >
              <XMarkIcon className="size-3" strokeWidth={3} />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="font-serif text-sm text-soft">None yet.</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button variant="secondary" size="compact" disabled={!draft.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
