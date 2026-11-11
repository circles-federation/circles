"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Eyebrow, Input, Label, Select } from "@/components/shared";
import { useMemberById } from "@/lib/hooks";
import { circleHasTasks } from "@/lib/circles.util";
import { localDay } from "@/lib/recurrence.util";
import { TASK_TITLE_MAX, dueCell, validateTask, type TaskInput } from "@/lib/tasks.util";
import type { Circle, Member, MeetingSession } from "@/lib/types";

const BLANK = { title: "", dueDate: "", assigneeId: null as number | null };

/* What needs doing after the meeting: anyone there adds a task (a title, who
   has it and when it's due), which goes into the circle's backlog like any
   other, marked as from this meeting. Whoever it's given to is told. Anything
   more than that is the task's own page. */
export function MeetingTasksStep({ session, circle, canAdd, memberId, onAdd }: { session: MeetingSession; circle: Circle; canAdd: boolean; memberId: number; onAdd: (input: TaskInput) => Promise<boolean> }) {
  const memberById = useMemberById();
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const today = localDay();

  if (!circleHasTasks(circle)) {
    return (
      <div>
        <Eyebrow className="text-soft">Tasks</Eyebrow>
        <p className="mt-3 font-serif text-base text-soft">This circle doesn’t keep tasks, so there’s nothing to add here.</p>
      </div>
    );
  }

  const people = circle.members
    .map((id) => memberById(id))
    .filter((m): m is Member => !!m)
    .sort((a, b) => (a.id === memberId ? -1 : b.id === memberId ? 1 : a.name.localeCompare(b.name)));

  const add = async () => {
    const input: TaskInput = { title: draft.title, description: "", status: "todo", priority: "none", dueDate: draft.dueDate, assigneeId: draft.assigneeId };
    const found = validateTask(input, circle.members);
    const problem = found.title ?? found.dueDate ?? found.assigneeId ?? null;
    setError(problem);
    if (problem) return;
    setAdding(true);
    const ok = await onAdd(input);
    setAdding(false);
    if (ok) setDraft(BLANK);
  };

  return (
    <div>
      <Eyebrow className="text-soft">Tasks · {session.tasks.length}</Eyebrow>
      <p className="mt-2 font-serif text-base text-soft">Anything that needs doing after this meeting.</p>

      {session.tasks.length > 0 && (
        <ul className="m-0 mt-6 flex list-none flex-col border-t border-faint p-0">
          {session.tasks.map((t) => {
            const who = t.assigneeId !== undefined ? memberById(t.assigneeId) : undefined;
            const due = dueCell(t, today);
            return (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-faint py-3">
                <Link href={`/circles/${circle.id}/tasks/${t.id}`} target="_blank" className="font-sans text-base font-bold underline wrap-anywhere">
                  {t.title}
                </Link>
                <span className="font-serif text-sm text-soft">
                  {who ? who.name : "No one yet"}
                  {due ? ` · ${due.text}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {canAdd ? (
        <form
          className="mt-8 border-t border-faint pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          noValidate
        >
          <Eyebrow className="text-soft">Add a task</Eyebrow>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="meeting-task-title">Title</Label>
              <Input id="meeting-task-title" value={draft.title} maxLength={TASK_TITLE_MAX} placeholder="What needs doing" onChange={(e) => (setError(null), setDraft({ ...draft, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div>
                <Label htmlFor="meeting-task-assignee">Assigned to</Label>
                <Select id="meeting-task-assignee" value={draft.assigneeId === null ? "" : String(draft.assigneeId)} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">No one yet</option>
                  {people.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === memberId ? `Me (${m.name})` : m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="meeting-task-due">Due (optional)</Label>
                <Input id="meeting-task-due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </div>
            </div>
          </div>
          {error && <p className="mt-2 font-sans text-xs font-bold text-danger">{error}</p>}
          <div className="mt-4">
            <Button type="submit" variant="secondary" size="compact" disabled={adding}>
              Add task
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 font-serif text-sm text-soft">Mark yourself present to add tasks.</p>
      )}
    </div>
  );
}
