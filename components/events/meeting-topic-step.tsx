"use client";

import { useState } from "react";
import { AgendaBadge } from "./agenda-section";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Eyebrow, TextArea } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { MEETING_NOTES_MAX } from "@/lib/meeting-session.util";
import type { MeetingTopic } from "@/lib/types";

/* One topic and the notes taken on it (Markdown; a decision is written in
   them). Saved when the field loses focus. Others may be writing too, last
   write wins: while this one's being typed in, what someone else saved isn't
   put over it, but it's said so, since saving will replace it. */
export function MeetingTopicStep({ topic, canWrite, onSave }: { topic: MeetingTopic; canWrite: boolean; onSave: (notes: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null);
  // what was typed, from leaving the field until the save is answered, so the
  // old notes don't show in between; kept if the save is refused, so nothing
  // typed is lost
  const [held, setHeld] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
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
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow className="text-soft">
            <label htmlFor={`notes-${topic.position}`}>Notes</label>
          </Eyebrow>
          <span aria-live="polite" className={status === "failed" ? "font-sans text-xs font-bold text-danger" : "inline-flex items-center gap-1 font-sans text-xs font-bold text-soft"}>
            {status === "saving" && "Saving…"}
            {status === "saved" && (
              <>
                <CheckIcon className="size-4 text-leaf" strokeWidth={2.5} aria-hidden />
                Saved
              </>
            )}
            {status === "failed" && "Not saved"}
          </span>
        </div>
        <TextArea
          id={`notes-${topic.position}`}
          className="mt-2 min-h-40"
          value={draft?.text ?? held ?? topic.notes}
          maxLength={MEETING_NOTES_MAX}
          disabled={!canWrite}
          placeholder={topic.category === "decide" ? "What was decided, and by whom…" : "What was said…"}
          onFocus={() => setDraft({ text: held ?? topic.notes, base: topic.notes })}
          onChange={(e) => {
            setStatus("idle");
            setDraft({ text: e.target.value, base: draft?.base ?? topic.notes });
          }}
          onBlur={async () => {
            if (!draft) return;
            const text = draft.text;
            setDraft(null);
            if (text === topic.notes) return setHeld(null);
            setHeld(text);
            setStatus("saving");
            const ok = await onSave(text);
            if (ok) setHeld(null);
            setStatus(ok ? "saved" : "failed");
          }}
        />
      </div>
      {changedElsewhere && <p className="mt-2 font-sans text-xs font-bold text-flame">Someone else has changed these notes. Saving will replace their version.</p>}
      {!canWrite && <p className="mt-2 font-serif text-sm text-soft">Mark yourself present to take notes.</p>}
    </div>
  );
}
