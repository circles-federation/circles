"use client";

import { useRef, useState } from "react";
import { Button, Input, Label, Select } from "@/components/shared";
import { useHistoryState, useMemberById } from "@/lib/hooks";
import { TASK_TITLE_MAX, validateTask, type TaskErrors, type TaskInput } from "@/lib/tasks.util";
import type { Circle, Member, MeetingSession } from "@/lib/types";

const BLANK = { title: "", dueDate: "", assigneeId: null as number | null };

const errorText = (id: string, text?: string) =>
  text && (
    <p id={id} role="alert" className="mt-1.5 font-sans text-xs font-bold text-danger">
      {text}
    </p>
  );

/* The form for a task that comes out of a meeting: a title, who has it and
   when it's due, saved into the circle's backlog marked as from this meeting
   (anything more is the task's own page). Used by the Tasks step and by a
   topic's New task, which differ only in where the half-written draft is kept
   (`stateKey`, on the history entry, so it survives opening a task and Back)
   and what happens after an add (`onAdded`). After an add the title is focused
   again, for the next one. */
export function MeetingTaskForm({
  session,
  circle,
  memberId,
  onAdd,
  stateKey,
  idPrefix,
  onAdded,
}: {
  session: MeetingSession;
  circle: Circle;
  memberId: number;
  onAdd: (input: TaskInput) => Promise<boolean>;
  stateKey: string;
  idPrefix: string;
  onAdded?: () => void;
}) {
  const memberById = useMemberById();
  const [draft, setDraft] = useHistoryState(stateKey, BLANK);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [adding, setAdding] = useState(false);
  const [announce, setAnnounce] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

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
    onAdded?.();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
      noValidate
    >
      <div>
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          ref={titleRef}
          value={draft.title}
          maxLength={TASK_TITLE_MAX}
          placeholder="What needs doing"
          enterKeyHint="done"
          autoComplete="off"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined}
          onChange={(e) => set({ title: e.target.value })}
        />
        {errorText(`${idPrefix}-title-error`, errors.title)}
      </div>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-assignee`}>Assigned to</Label>
          <Select id={`${idPrefix}-assignee`} value={draft.assigneeId === null ? "" : String(draft.assigneeId)} onChange={(e) => set({ assigneeId: e.target.value ? Number(e.target.value) : null })}>
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
          {errorText(`${idPrefix}-assignee-error`, errors.assigneeId)}
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-due`}>Due (optional)</Label>
          <Input id={`${idPrefix}-due`} type="date" value={draft.dueDate} aria-invalid={!!errors.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          {errorText(`${idPrefix}-due-error`, errors.dueDate)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" variant="secondary" size="compact" disabled={adding}>
          {adding ? "Adding…" : "Add task"}
        </Button>
        {assignee && <p className="m-0 font-serif text-sm text-soft">{assignee.name.split(" ")[0]} will be told.</p>}
      </div>
      <p role="status" className="sr-only">
        {announce}
      </p>
    </form>
  );
}
