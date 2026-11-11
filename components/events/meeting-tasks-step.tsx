"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button, Eyebrow, Input, Label, Select } from "@/components/shared";
import { useMemberById } from "@/lib/hooks";
import { circleHasTasks } from "@/lib/circles.util";
import { localDay } from "@/lib/recurrence.util";
import { TASK_TITLE_MAX, dueCell, validateTask, type TaskErrors, type TaskInput } from "@/lib/tasks.util";
import type { Circle, Member, MeetingSession } from "@/lib/types";

const BLANK = { title: "", dueDate: "", assigneeId: null as number | null };

const errorText = (id: string, text?: string) =>
  text && (
    <p id={id} role="alert" className="mt-1.5 font-sans text-xs font-bold text-danger">
      {text}
    </p>
  );

/* What needs doing after the meeting: anyone there adds a task (a title, who
   has it and when it's due), which goes into the circle's backlog like any
   other, marked as from this meeting. Whoever it's given to is told. Anything
   more than that is the task's own page.

   The form leads and what's been added follows, newest first, so the field
   stays where the thumb is as others add theirs (a list growing above it would
   push it down), and what was just added shows right under it. After an add the
   title is focused again, for the next one. */
export function MeetingTasksStep({ session, circle, canAdd, memberId, onAdd }: { session: MeetingSession; circle: Circle; canAdd: boolean; memberId: number; onAdd: (input: TaskInput) => Promise<boolean> }) {
  const memberById = useMemberById();
  const [draft, setDraft] = useState(BLANK);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [adding, setAdding] = useState(false);
  const [announce, setAnnounce] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const today = localDay();

  if (!circleHasTasks(circle)) {
    return (
      <div>
        <Eyebrow className="text-soft">Tasks</Eyebrow>
        <p className="mt-3 font-serif text-base text-soft">This circle doesn’t keep tasks, so there’s nothing to add here.</p>
      </div>
    );
  }

  // you first, then those who are here, then the rest of the circle
  const people = circle.members.map((id) => memberById(id)).filter((m): m is Member => !!m);
  const byName = (a: Member, b: Member) => a.name.localeCompare(b.name);
  const me = people.find((m) => m.id === memberId);
  const here = people.filter((m) => m.id !== memberId && session.attendees.includes(m.id)).sort(byName);
  const away = people.filter((m) => m.id !== memberId && !session.attendees.includes(m.id)).sort(byName);
  const option = (m: Member) => (
    <option key={m.id} value={m.id}>
      {m.name}
    </option>
  );
  const assignee = draft.assigneeId !== null && draft.assigneeId !== memberId ? memberById(draft.assigneeId) : undefined;
  const newestFirst = [...session.tasks].reverse();

  const set = (patch: Partial<typeof BLANK>) => {
    setDraft({ ...draft, ...patch });
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k as keyof TaskErrors];
      return next;
    });
  };

  const add = async () => {
    if (adding) return;
    const input: TaskInput = { title: draft.title, description: "", status: "todo", priority: "none", dueDate: draft.dueDate, assigneeId: draft.assigneeId };
    const found = validateTask(input, circle.members);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setAdding(true);
    const ok = await onAdd(input);
    setAdding(false);
    if (!ok) return;
    setAnnounce(`Added: ${input.title.trim()}`);
    setDraft(BLANK);
    titleRef.current?.focus();
  };

  return (
    <div>
      <Eyebrow className="text-soft">Tasks · {session.tasks.length}</Eyebrow>
      <p className="mt-2 font-serif text-base text-soft">Anything that needs doing after this meeting.</p>

      {canAdd ? (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="meeting-task-title">Title</Label>
            <Input
              id="meeting-task-title"
              ref={titleRef}
              value={draft.title}
              maxLength={TASK_TITLE_MAX}
              placeholder="What needs doing"
              enterKeyHint="done"
              autoComplete="off"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "meeting-task-title-error" : undefined}
              onChange={(e) => set({ title: e.target.value })}
            />
            {errorText("meeting-task-title-error", errors.title)}
          </div>
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor="meeting-task-assignee">Assigned to</Label>
              <Select id="meeting-task-assignee" value={draft.assigneeId === null ? "" : String(draft.assigneeId)} onChange={(e) => set({ assigneeId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">No one yet</option>
                {me && <option value={me.id}>Me ({me.name})</option>}
                {here.length > 0 && away.length > 0 ? (
                  <>
                    <optgroup label="Here">{here.map(option)}</optgroup>
                    <optgroup label="Not here">{away.map(option)}</optgroup>
                  </>
                ) : (
                  [...here, ...away].map(option)
                )}
              </Select>
              {errorText("meeting-task-assignee-error", errors.assigneeId)}
            </div>
            <div>
              <Label htmlFor="meeting-task-due">Due (optional)</Label>
              <Input id="meeting-task-due" type="date" value={draft.dueDate} aria-invalid={!!errors.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              {errorText("meeting-task-due-error", errors.dueDate)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="submit" variant="secondary" size="compact" disabled={adding}>
              {adding ? "Adding…" : "Add task"}
            </Button>
            {assignee && <p className="m-0 font-serif text-sm text-soft">{assignee.name.split(" ")[0]} will be told.</p>}
          </div>
        </form>
      ) : (
        <p className="mt-6 font-serif text-sm text-soft">Mark yourself present to add tasks.</p>
      )}

      <p role="status" className="sr-only">
        {announce}
      </p>

      <div className="mt-8 border-t border-faint pt-6">
        {newestFirst.length === 0 ? (
          <p className="font-serif text-lg text-soft">Tasks you add will appear here, and in the circle’s Tasks.</p>
        ) : (
          <ul aria-label="Tasks added in this meeting" className="m-0 flex list-none flex-col p-0">
            {newestFirst.map((t) => {
              const who = t.assigneeId !== undefined ? memberById(t.assigneeId) : undefined;
              const due = dueCell(t, today);
              return (
                <li key={t.id} className="border-b border-faint py-3 first:pt-0">
                  <Link href={`/circles/${circle.id}/tasks/${t.id}`} target="_blank" className="font-sans text-base leading-tight font-bold underline wrap-anywhere">
                    {t.title}
                  </Link>
                  <div className="mt-1 font-serif text-sm text-soft">
                    {who ? who.name : "No one yet"}
                    {due && (
                      <>
                        {" · "}
                        <span className={due.overdue ? "font-bold text-danger" : undefined}>{due.text}</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
