"use client";

import { useEffect, useRef, useState } from "react";
import { AgendaBadge } from "./agenda-section";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { MeetingTaskForm } from "./meeting-task-form";
import { MessageEditor } from "@/components/circles/message-editor";
import { Button, Eyebrow } from "@/components/shared";
import { Modal } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { circleHasTasks } from "@/lib/circles.util";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import type { TaskInput } from "@/lib/tasks.util";
import type { Circle, MeetingSession, MeetingTopic } from "@/lib/types";

/* One topic and the notes taken on it (Markdown; a decision is written in
   them). Saved when the field loses focus and, since a toolbar's link field
   takes focus from the editor before the link is applied (and formatting
   leaves it focused), shortly after the last change too. Others may be writing too, last
   write wins: while this one's being typed in, what someone else saved isn't
   put over it, but it's said so, since saving will replace it. */
// how long after the last change the notes save by themselves
const SAVE_AFTER_MS = 1200;

export function MeetingTopicStep({
  topic,
  canWrite,
  onSave,
  session,
  circle,
  memberId,
  onAddTask,
}: {
  topic: MeetingTopic;
  canWrite: boolean;
  onSave: (notes: string) => Promise<boolean>;
  session: MeetingSession;
  circle: Circle;
  memberId: number;
  onAddTask: (input: TaskInput) => Promise<boolean>;
}) {
  const { showToast } = useToast();
  // tasks come up while a topic is discussed, so one can be made from here
  const [taskOpen, setTaskOpen] = useState(false);
  const newTaskButton = useRef<HTMLButtonElement>(null);
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flush = async () => {
    clearTimeout(timer.current);
    const { draft: unsaved, notes, onSave: save } = pending.current;
    if (!unsaved) return;
    const text = unsaved.text;
    setDraft(null);
    if (text === notes) return setHeld(null);
    setHeld(text);
    setStatus("saving");
    const ok = await save(text);
    if (ok) setHeld(null);
    // not "saved" while something newer is waiting to be
    if (!pending.current.draft) setStatus(ok ? "saved" : "failed");
  };
  const editing = draft !== null;
  const changedElsewhere = editing && topic.notes !== draft.base;
  const hint = AGENDA_CATEGORY[topic.category].hint;
  return (
    <div>
      {/* the topic as the agenda draws it: a boxed card ruled along its top in
          the agenda colour */}
      <div className="border border-t-[3px] border-ink border-t-agenda bg-paper p-4">
        <div className="flex items-center gap-2">
          <AgendaBadge category={topic.category} />
          <Eyebrow className="text-agenda">{AGENDA_CATEGORY[topic.category].label}</Eyebrow>
        </div>
        <h2 className="mt-3 font-sans text-xl leading-tight font-extrabold tracking-heading wrap-anywhere">{topic.title}</h2>
        {topic.details && <p className="mt-2 font-serif text-base whitespace-pre-line text-body">{topic.details}</p>}
        <p className="mt-2 font-serif text-sm text-soft">{hint}</p>
      </div>
      <div className="mt-6">
        <div className="flex h-6 items-center justify-between gap-3">
          <Eyebrow>Notes</Eyebrow>
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
            boxed
            id={`notes-${topic.id}`}
            label={`Notes on ${topic.title}`}
            value={draft?.text ?? held ?? topic.notes}
            readOnly={!canWrite}
            placeholder={AGENDA_CATEGORY[topic.category].notesPlaceholder}
            onChange={(text) => {
              setStatus("idle");
              setDraft({ text, base: draft?.base ?? topic.notes });
              clearTimeout(timer.current);
              timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
            }}
            onBlur={() => void flush()}
          />
        </div>
      </div>
      {canWrite && circleHasTasks(circle) && (
        <div className="mt-4">
          <Button ref={newTaskButton} variant="secondary" size="compact" onClick={() => setTaskOpen(true)}>
            <PlusIcon className="size-4" aria-hidden />
            New task
          </Button>
        </div>
      )}
      {taskOpen && (
        <Modal title="New task" onClose={() => setTaskOpen(false)} className="max-w-lg">
          <div className="p-5">
            <MeetingTaskForm
              session={session}
              circle={circle}
              memberId={memberId}
              onAdd={onAddTask}
              stateKey={`meeting-topic-task-draft-${topic.id}`}
              idPrefix="topic-task"
              onAdded={() => {
                setTaskOpen(false);
                showToast({ message: "Task added.", tone: "success" });
                // the dialog is gone, so focus goes back to what opened it
                setTimeout(() => newTaskButton.current?.focus(), 0);
              }}
            />
          </div>
        </Modal>
      )}
      {changedElsewhere && <p className="mt-2 font-sans text-xs font-bold text-flame-text">Someone else has changed these notes. Saving will replace their version.</p>}
      {!canWrite && <p className="mt-2 font-serif text-sm text-soft">Mark yourself present to take notes.</p>}
    </div>
  );
}
