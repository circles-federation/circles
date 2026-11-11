"use client";

import { useEffect, useRef, useState } from "react";
import { AgendaBadge } from "./agenda-section";
import { CheckIcon } from "@heroicons/react/24/outline";
import { MessageEditor } from "@/components/circles/message-editor";
import { Eyebrow } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
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
  /* Saved if it goes while it's being typed in: the facilitator moving the
     meeting on (or leaving the page) takes this topic's editor away mid-sentence,
     which mustn't lose what's been written since it last lost focus. */
  const pending = useRef({ draft, notes: topic.notes, onSave });
  useEffect(() => {
    pending.current = { draft, notes: topic.notes, onSave };
  });
  useEffect(
    () => () => {
      const { draft: unsaved, notes, onSave: save } = pending.current;
      if (unsaved && unsaved.text !== notes) void save(unsaved.text);
    },
    [],
  );
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
          <Eyebrow className="text-soft">Notes</Eyebrow>
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
        <div className="mt-2">
          <MessageEditor
            id={`notes-${topic.position}`}
            label={`Notes on ${topic.title}`}
            value={draft?.text ?? held ?? topic.notes}
            readOnly={!canWrite}
            placeholder={topic.category === "decide" ? "What was decided, and by whom… Select text to format it." : "What was said… Select text to format it."}
            onChange={(text) => {
              setStatus("idle");
              setDraft({ text, base: draft?.base ?? topic.notes });
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
      </div>
      {changedElsewhere && <p className="mt-2 font-sans text-xs font-bold text-flame">Someone else has changed these notes. Saving will replace their version.</p>}
      {!canWrite && <p className="mt-2 font-serif text-sm text-soft">Mark yourself present to take notes.</p>}
    </div>
  );
}
