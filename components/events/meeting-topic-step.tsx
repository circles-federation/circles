"use client";

import { useState } from "react";
import { AgendaBadge } from "./agenda-section";
import { Eyebrow, TextArea } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { MEETING_NOTES_MAX } from "@/lib/meeting-session.util";
import type { MeetingTopic } from "@/lib/types";

/* One topic and the notes taken on it (Markdown; a decision is written in
   them). Saved when the field loses focus. Others may be writing too, last
   write wins: while this one's being typed in, what someone else saved isn't
   put over it, but it's said so, since saving will replace it. */
export function MeetingTopicStep({ topic, canWrite, onSave }: { topic: MeetingTopic; canWrite: boolean; onSave: (notes: string) => void }) {
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null);
  const editing = draft !== null;
  const changedElsewhere = editing && topic.notes !== draft.base;
  const hint = AGENDA_CATEGORY[topic.category].hint;
  return (
    <div>
      <div className="flex items-center gap-2">
        <AgendaBadge category={topic.category} />
        <Eyebrow className="text-agenda">{AGENDA_CATEGORY[topic.category].label}</Eyebrow>
      </div>
      <h2 className="mt-3 font-sans text-xl leading-tight font-extrabold tracking-heading wrap-anywhere">{topic.title}</h2>
      {topic.details && <p className="mt-2 font-serif text-base whitespace-pre-line text-body">{topic.details}</p>}
      <p className="mt-2 font-serif text-sm text-soft">{hint}</p>
      <label className="mt-6 block">
        <Eyebrow className="text-soft">Notes</Eyebrow>
        <TextArea
          className="mt-2 min-h-40"
          value={draft?.text ?? topic.notes}
          maxLength={MEETING_NOTES_MAX}
          disabled={!canWrite}
          placeholder={topic.category === "decide" ? "What was decided, and by whom…" : "What was said…"}
          onFocus={() => setDraft({ text: topic.notes, base: topic.notes })}
          onChange={(e) => setDraft({ text: e.target.value, base: draft?.base ?? topic.notes })}
          onBlur={() => {
            if (draft && draft.text !== topic.notes) onSave(draft.text);
            setDraft(null);
          }}
        />
      </label>
      {changedElsewhere && <p className="mt-2 font-sans text-xs font-bold text-flame">Someone else has changed these notes. Saving will replace their version.</p>}
      {!canWrite && <p className="mt-2 font-serif text-sm text-soft">Mark yourself present to take notes.</p>}
    </div>
  );
}
