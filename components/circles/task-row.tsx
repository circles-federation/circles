"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useMemberById } from "@/lib/hooks";
import { localDay } from "@/lib/recurrence.util";
import { dueLabel, taskPriority } from "@/lib/tasks.util";
import type { CircleTask, TaskPriority } from "@/lib/types";

// each priority's mark in its own weight of attention: urgent red, high
// orange, normal ink, and the two that ask for none in grey
export const PRIORITY_TEXT: Record<TaskPriority, string> = { urgent: "text-danger", high: "text-flame", normal: "text-ink", none: "text-ghost", someday: "text-soft" };

interface TaskRowProps {
  task: CircleTask;
  onOpen: () => void;
  // named where tasks from several circles are listed together (Home)
  circleName?: string;
}

/* One task in a list: a round button that marks it done (or not), its
   priority's mark, its title with when it's due and who has it, and their
   photo. The rest opens it. A row, so it doesn't invert when pressed; the
   round button does, being a control of its own. */
export function TaskRow({ task: t, onOpen, circleName }: TaskRowProps) {
  const { updateTask } = useAppState();
  const memberById = useMemberById();
  const assignee = t.assigneeId !== undefined ? memberById(t.assigneeId) : undefined;
  const done = t.status === "done";
  const due = dueLabel(t, localDay());
  const priority = taskPriority(t.priority);

  function toggleDone() {
    void updateTask(t.id, {
      title: t.title,
      description: t.description,
      status: done ? "todo" : "done",
      priority: t.priority,
      dueDate: t.dueDate ?? "",
      assigneeId: t.assigneeId ?? null,
    });
  }

  return (
    <li className="flex items-center gap-3 border-b border-faint py-3 last:border-b-ink">
      <button
        type="button"
        onClick={toggleDone}
        aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
        aria-pressed={done}
        className={clsx("hit flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-ink", done ? "btn-invert btn-ink bg-ink text-paper" : "ink-press bg-paper text-ink")}
      >
        {done && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left">
        <span title={priority.label} className={clsx("w-8 shrink-0 font-sans text-sm font-extrabold", PRIORITY_TEXT[t.priority])}>
          {priority.mark}
          <span className="sr-only">{priority.label}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("block truncate font-sans text-base font-bold", done ? "text-soft line-through" : "text-ink")}>{t.title}</span>
          <span className="block truncate font-serif text-sm text-soft">
            {[
              circleName,
              t.status === "doing" ? "In progress" : null,
              due ? <span key="due" className={clsx(due.overdue && "font-bold text-danger")}>{due.text}</span> : null,
              assignee ? assignee.name : "No one yet",
            ]
              .filter(Boolean)
              .flatMap((part, i) => (i === 0 ? [part] : [" · ", part]))}
          </span>
        </span>
        {assignee && <Avatar member={assignee} size={28} />}
      </button>
    </li>
  );
}
