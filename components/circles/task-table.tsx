"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar } from "@/components/shared";
import { useMemberById, useTaskTick } from "@/lib/hooks";
import { localDay } from "@/lib/recurrence.util";
import { TASK_STATUSES, dueCell, onBackBurner, sortTasks, taskPriority } from "@/lib/tasks.util";
import type { CircleTask } from "@/lib/types";

// a column a phone leaves out
const WIDE = "hidden min-[720px]:table-cell";
// a cell's room either side, in the header and the rows alike
const CELL = "px-2";

interface TaskTableProps {
  tasks: CircleTask[];
  onOpen: (task: CircleTask) => void;
  // the table's name for screen readers
  label: string;
}

/* Tasks as one table, whatever their status (what's live, then the back
   burner, then what's done, each soonest due first), under a header
   row in ink, its rows alternately white and grey: a round button that marks
   each done (or not), then its title, status, priority (a column with no
   heading, since each row's mark says what it is), when it's due and who has
   it. A phone keeps the title, priority and due date,
   with "In progress" under the title in place of the Status column. Within
   each part, the soonest due comes first, undated last, then the most
   pressing, then by name. A row opens its task; it doesn't invert when
   pressed, being a row, but its round button does. */
export function TaskTable({ tasks, onOpen, label }: TaskTableProps) {
  // ticking one done, and again to put it back as it was
  const { toggle: toggleDone } = useTaskTick();
  const memberById = useMemberById();
  // one table, whatever their status: what's live, then the back burner,
  // then what's done, each by when it's due
  const sorted = [
    tasks.filter((t) => t.status !== "done" && !onBackBurner(t)),
    tasks.filter(onBackBurner),
    tasks.filter((t) => t.status === "done"),
  ].flatMap(sortTasks);
  const today = localDay();

  // every heading centred on the header row's height, label or not
  const heading = clsx(CELL, "py-3 text-left align-middle font-sans text-label leading-none font-bold tracking-caps text-on-chrome uppercase");

  return (
    // fixed widths, so a long title wraps rather than squeezing the rest
    <table className="w-full table-fixed border-collapse" aria-label={label}>
      {/* the header row in chrome (ink, in Sol); on-chrome sets keyboard focus to match */}
      <thead className="on-chrome bg-chrome">
        <tr>
          <th scope="col" className="w-11 py-3 pl-3 align-middle">
            <span className="sr-only">Done</span>
          </th>
          <th scope="col" className={heading}>Task</th>
          <th scope="col" className={clsx(heading, "w-28", WIDE)}>Status</th>
          {/* no label: each row's mark says what this column is */}
          <th scope="col" className={clsx(heading, "w-12 min-[720px]:w-16")}>
            <span className="sr-only">Priority</span>
          </th>
          <th scope="col" className={clsx(heading, "w-20 min-[720px]:w-28")}>Due</th>
          <th scope="col" className={clsx(heading, "w-40", WIDE)}>Assigned to</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => {
          const done = t.status === "done";
          const due = dueCell(t, today);
          const priority = taskPriority(t.priority);
          const assignee = t.assigneeId !== undefined ? memberById(t.assigneeId) : undefined;
          return (
            // alternate rows white and grey, darker under the pointer
            <tr key={t.id} onClick={() => onOpen(t)} className="cursor-pointer align-middle odd:bg-paper even:bg-wash hover:bg-faint">
              <td className="py-3 pl-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDone(t);
                  }}
                  aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                  aria-pressed={done}
                  className={clsx("hit flex size-6 cursor-pointer items-center justify-center rounded-full border-2 border-ink", done ? "btn-invert btn-ink bg-ink text-paper" : "ink-press bg-paper text-ink")}
                >
                  {done && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
                </button>
              </td>
              <td className={clsx(CELL, "py-3")}>
                {/* the title is the row's own way in for the keyboard */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(t);
                  }}
                  className={clsx("cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-base font-bold wrap-anywhere", done ? "text-soft line-through" : "text-ink")}
                >
                  {t.title}
                </button>
                {/* a phone has no Status column: In progress here instead (Done
                    shows in the round button and the struck title) */}
                {t.status === "doing" && <span className="mt-0.5 block font-serif text-sm text-soft min-[720px]:hidden">In progress</span>}
              </td>
              <td className={clsx(CELL, "py-3 font-serif text-sm whitespace-nowrap", t.status === "doing" ? "text-ink" : "text-soft", WIDE)}>
                {TASK_STATUSES.find((s) => s.key === t.status)?.label}
              </td>
              <td className={clsx(CELL, "py-3")}>
                <span title={priority.label} className="text-lg leading-none">
                  {priority.mark}
                  <span className="sr-only">{priority.label}</span>
                </span>
              </td>
              <td className={clsx(CELL, "py-3 font-serif text-sm whitespace-nowrap", due?.overdue ? "font-bold text-danger" : "text-soft")}>
                {due ? (
                  <>
                    {/* a phone leaves out the weekday: "Oct 24" */}
                    {due.text.includes(", ") ? (
                      <>
                        <span className="hidden min-[720px]:inline">{due.text.split(", ")[0]}, </span>
                        {due.text.split(", ")[1]}
                      </>
                    ) : (
                      due.text
                    )}
                    {due.overdue && <span className="sr-only"> (overdue)</span>}
                  </>
                ) : (
                  <span className="text-ghost">–</span>
                )}
              </td>
              <td className={clsx(CELL, "py-3 pr-3", WIDE)}>
                {assignee ? (
                  <span className="flex items-center gap-2 font-serif text-sm text-body">
                    <Avatar member={assignee} size={24} />
                    <span className="truncate">{assignee.name}</span>
                  </span>
                ) : (
                  <span className="font-serif text-sm text-ghost">No one yet</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
