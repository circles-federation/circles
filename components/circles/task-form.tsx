"use client";

import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { Button, ConfirmModal, Input, Label, Modal, Select, TextArea, togglePress } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useMemberById } from "@/lib/hooks";
import { TASK_DESCRIPTION_MAX, TASK_PRIORITIES, TASK_STATUSES, TASK_TITLE_MAX, taskPriority, validateTask, type TaskErrors, type TaskInput } from "@/lib/tasks.util";
import type { Circle, CircleTask, Member } from "@/lib/types";

/* Adding or editing one of a circle's tasks, in either of two shells, as a
   bulletin item is: a dialog on desktop (TaskFormModal, below) and a page of
   its own on a phone or when it's opened from elsewhere (TaskFormPage). Both
   hold the same state through useTaskForm and render the same TaskFields.
   Saved straight away; anyone it's given to who didn't do it themselves is
   told. */
export function useTaskForm(circle: Circle, task: CircleTask | null, onSaved: () => void) {
  const { addTask, updateTask } = useAppState();
  const initial: TaskInput = {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "none",
    dueDate: task?.dueDate ?? "",
    assigneeId: task?.assigneeId ?? null,
  };
  const [input, setInput] = useState<TaskInput>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = (Object.keys(initial) as (keyof TaskInput)[]).some((k) => input[k] !== initial[k]);
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const { [key]: _gone, ...rest } = prev;
      return rest;
    });
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    // instant feedback only — the server checks again, and is the real check
    const found = validateTask(input, circle.members);
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = task ? await updateTask(task.id, input) : await addTask(circle.id, input);
    setBusy(false);
    if (result.ok) onSaved();
    else setServerError(result.error);
  }

  return { input, set, errors, serverError, busy, dirty, submit };
}

export type TaskFormState = ReturnType<typeof useTaskForm>;

const errorText = (text?: string) => text && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{text}</p>;

export function TaskFields({ form, circle }: { form: TaskFormState; circle: Circle }) {
  const { input, set, errors, serverError } = form;
  const { profile } = useAppState();
  const memberById = useMemberById();
  // the circle's members, you first, then by name
  const people = circle.members
    .map((id) => memberById(id))
    .filter((m): m is Member => !!m)
    .sort((a, b) => (a.id === profile.id ? -1 : b.id === profile.id ? 1 : a.name.localeCompare(b.name)));

  return (
    <>
      <div>
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" value={input.title} onChange={(e) => set("title", e.target.value)} maxLength={TASK_TITLE_MAX} placeholder="What needs doing" />
        {errorText(errors.title)}
      </div>

      <div>
        <Label id="task-status-label">Status</Label>
        <div role="radiogroup" aria-labelledby="task-status-label" className="grid grid-cols-3 gap-2">
          {TASK_STATUSES.map((s) => {
            const on = input.status === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("status", s.key)}
                className={clsx("hit cursor-pointer border border-ink px-2 py-3 font-sans text-sm font-bold", togglePress(on), on ? "bg-ink text-paper" : "bg-paper text-ink")}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {errorText(errors.status)}
      </div>

      <div>
        <Label id="task-priority-label">Priority</Label>
        {/* each as its mark, the way the lists show it, with what the chosen
            one means under them */}
        <div role="radiogroup" aria-labelledby="task-priority-label" className="grid grid-cols-5 gap-2">
          {TASK_PRIORITIES.map((p) => {
            const on = input.priority === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={p.label}
                title={p.label}
                onClick={() => set("priority", p.key)}
                className={clsx(
                  "hit cursor-pointer border border-ink px-1 py-3 font-sans",
                  togglePress(on),
                  on ? "bg-ink text-paper" : "bg-paper text-soft"
                )}
              >
                {/* Normal has no mark of its own, so its button says its name:
                    in sentence case at the smallest size, to fit a fifth of a
                    phone's width */}
                {p.mark ? <span className="text-lg leading-none">{p.mark}</span> : <span className="text-label font-bold">Normal</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 font-serif text-sm text-soft">{taskPriority(input.priority).label}{input.priority === "someday" && ": kept off the list until it's moved up"}</p>
        {errorText(errors.priority)}
      </div>

      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2">
        <div>
          <Label htmlFor="task-due">Due (optional)</Label>
          <div className="flex items-stretch gap-2">
            <Input id="task-due" type="date" value={input.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="min-w-0 flex-1" />
            {input.dueDate && (
              <Button type="button" variant="secondary" size="compact" onClick={() => set("dueDate", "")}>
                Clear
              </Button>
            )}
          </div>
          {errorText(errors.dueDate)}
        </div>
        <div>
          <Label htmlFor="task-assignee">Assigned to</Label>
          <Select id="task-assignee" value={input.assigneeId === null ? "" : String(input.assigneeId)} onChange={(e) => set("assigneeId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">No one yet</option>
            {people.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === profile.id ? `Me (${m.name})` : m.name}
              </option>
            ))}
          </Select>
          {errorText(errors.assigneeId)}
        </div>
      </div>

      <div>
        <Label htmlFor="task-description">Description (optional)</Label>
        <TextArea id="task-description" value={input.description} onChange={(e) => set("description", e.target.value)} maxLength={TASK_DESCRIPTION_MAX} rows={4} placeholder="Anything that helps whoever picks it up" />
        {errorText(errors.description)}
      </div>

      {serverError && <p className="font-sans text-sm font-bold text-danger">{serverError}</p>}
    </>
  );
}

// deleting asks first, in either shell
export function DeleteTaskConfirm({ task, onCancel, onDeleted }: { task: CircleTask; onCancel: () => void; onDeleted: () => void }) {
  const { removeTask } = useAppState();
  return (
    <ConfirmModal
      title="Delete this task?"
      message={`“${task.title}” will be deleted for everyone in the circle.`}
      confirmLabel="Delete"
      cancelLabel="Keep it"
      onCancel={onCancel}
      onConfirm={async () => {
        const result = await removeTask(task.id);
        if (result.ok) onDeleted();
        else onCancel();
      }}
    />
  );
}

// the desktop shell: a dialog, with Save, Cancel and (editing) Delete at its foot
export function TaskFormModal({ circle, task, onClose }: { circle: Circle; task: CircleTask | null; onClose: () => void }) {
  const form = useTaskForm(circle, task, onClose);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Modal onClose={onClose} className="max-w-130" title={task ? "Edit task" : "New task"}>
        <form onSubmit={form.submit} noValidate className="flex flex-col gap-5 px-5 py-5">
          <TaskFields form={form} circle={circle} />
          <div className="flex gap-3">
            <Button type="submit" disabled={form.busy}>{form.busy ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            {task && (
              <Button type="button" variant="danger" onClick={() => setDeleting(true)} disabled={form.busy} className="ml-auto">
                Delete
              </Button>
            )}
          </div>
        </form>
      </Modal>
      {deleting && task && <DeleteTaskConfirm task={task} onCancel={() => setDeleting(false)} onDeleted={onClose} />}
    </>
  );
}
