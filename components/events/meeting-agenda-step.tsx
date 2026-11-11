"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { AgendaBadge } from "./agenda-section";
import { AgendaCategoryChoice, BLANK_AGENDA_ITEM, type AgendaDraft } from "./agenda-editor";
import { Button, ConfirmModal, Eyebrow, Input, TextArea } from "@/components/shared";
import { AGENDA_CATEGORY, MAX_AGENDA_ITEMS, validateAgendaItem } from "@/lib/agenda.util";
import type { AgendaItem, MeetingSession, MeetingTopic } from "@/lib/types";

/* The agenda as the meeting will run it, for those there to read through and
   change before discussion starts: anyone present can add a topic or take one
   off. It's this meeting's copy; the event's own agenda is left as it was. */
export function MeetingAgendaStep({ session, canEdit, onAdd, onRemove }: { session: MeetingSession; canEdit: boolean; onAdd: (item: AgendaItem) => Promise<boolean>; onRemove: (topicId: string) => void }) {
  const [draft, setDraft] = useState<AgendaDraft>(BLANK_AGENDA_ITEM);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MeetingTopic | null>(null);
  const [adding, setAdding] = useState(false);

  const add = async () => {
    const item: AgendaItem = { category: draft.category, title: draft.title, ...(draft.details.trim() ? { details: draft.details } : {}) };
    const problem = validateAgendaItem(item);
    setError(problem);
    if (problem) return;
    setAdding(true);
    const ok = await onAdd(item);
    setAdding(false);
    if (ok) setDraft({ ...BLANK_AGENDA_ITEM, category: draft.category });
  };

  return (
    <div>
      <Eyebrow className="text-soft">Agenda · {session.topics.length}</Eyebrow>
      <p className="mt-2 font-serif text-base text-soft">Read it through. Add anything that’s missing, or take off what won’t be discussed.</p>

      {session.topics.length === 0 ? (
        <p className="mt-6 font-serif text-lg text-soft">No topics yet.</p>
      ) : (
        <ol className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
          {session.topics.map((t) => (
            <li key={t.id} className="flex gap-3 border border-t-[3px] border-ink border-t-agenda bg-paper p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <AgendaBadge category={t.category} />
                  <Eyebrow className="min-w-0 flex-1 truncate text-agenda">{AGENDA_CATEGORY[t.category].label}</Eyebrow>
                  <span className="font-sans text-eyebrow font-bold text-soft tabular-nums" aria-label={`Topic ${t.position + 1}`}>{t.position + 1}</span>
                </div>
                <div className="mt-3 font-sans text-base leading-tight font-bold wrap-anywhere">{t.title}</div>
                {t.details && <p className="mt-2 font-serif text-sm leading-normal whitespace-pre-line text-body">{t.details}</p>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  title="Take off the agenda"
                  aria-label={`Take “${t.title}” off the agenda`}
                  onClick={() => (t.notes.trim() ? setRemoving(t) : onRemove(t.id))}
                  className="hit -mt-1 -mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center self-start border-none bg-transparent p-0 text-soft hover:text-ink"
                >
                  <XMarkIcon className="size-4" strokeWidth={2.5} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit ? (
        session.topics.length < MAX_AGENDA_ITEMS && (
          <form
            className="mt-8 border-t border-faint pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Eyebrow className="text-soft">Add a topic</Eyebrow>
            <div className="mt-4">
              <AgendaCategoryChoice value={draft.category} onChange={(category) => setDraft({ ...draft, category })} label="What the circle will do with the new topic" />
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <Input value={draft.title} onChange={(e) => (setError(null), setDraft({ ...draft, title: e.target.value }))} placeholder="Topic (e.g. Repair budget)" aria-label="New topic title" />
              <TextArea value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} rows={2} placeholder="Details (optional)" aria-label="New topic details" />
            </div>
            {error && <p className="mt-2 font-sans text-xs font-bold text-danger">{error}</p>}
            <div className="mt-4">
              <Button type="submit" variant="secondary" size="compact" disabled={adding}>
                Add topic
              </Button>
            </div>
          </form>
        )
      ) : (
        <p className="mt-6 font-serif text-sm text-soft">Mark yourself present to change the agenda.</p>
      )}

      {removing && (
        <ConfirmModal
          title="Take it off the agenda?"
          message={`“${removing.title}” has notes written on it, which would go with it.`}
          confirmLabel="Take off"
          cancelLabel="Keep it"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            onRemove(removing.id);
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}
