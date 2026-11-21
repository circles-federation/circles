"use client";

import { CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
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
  // where a row can be deleted outright, a last column with a trash button
  // (the meeting wizard's Tasks step, for what was just added there)
  onDelete?: (task: CircleTask) => void;
  // columns to leave out where the table is narrow (the meeting wizard's): a
  // hidden status is said under the title instead, as on a phone
  hide?: ("status" | "priority")[];
}

/* Tasks as one table, whatever their status (what's live, then the back
   burner, then what's done, each soonest due first), under a header
   row in ink, one box with ink lines between its rows: a square button that marks
   each done (or not), then its title, status, priority (a column with no
   heading, since each row's mark says what it is), when it's due and who has
   it. A phone keeps the title, priority and due date,
   with "In progress" under the title in place of the Status column. Within
   each part, the soonest due comes first, undated last, then the most
   pressing, then by name. A row opens its task; it doesn't invert when
   pressed, being a row, but its round button does. */
export function TaskTable({ tasks, onOpen, label, onDelete, hide = [] }: TaskTableProps) {
  const showStatus = !hide.includes("status");
  const showPriority = !hide.includes("priority");
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
  const heading = clsx(CELL, "py-3 text-left align-middle font-sans text-label leading-none font-bold tracking-caps text-page uppercase");

  return (
    // fixed widths, so a long title wraps rather than squeezing the rest
    <table className="w-full table-fixed border-collapse border border-ink bg-paper" aria-label={label}>
      {/* the header row in ink, its text the page colour so it reads in either theme */}
      <thead className="bg-ink">
        <tr>
          <th scope="col" className="w-11 py-3 pl-3 align-middle">
            <span className="sr-only">Done</span>
          </th>
          <th scope="col" className={heading}>Task</th>
          {showStatus && <th scope="col" className={clsx(heading, "w-28", WIDE)}>Status</th>}
          {/* no label: each row's mark says what this column is */}
          {showPriority && (
            <th scope="col" className={clsx(heading, "w-12 min-[720px]:w-16")}>
              <span className="sr-only">Priority</span>
            </th>
          )}
          <th scope="col" className={clsx(heading, "w-20 min-[720px]:w-28")}>Due</th>
          <th scope="col" className={clsx(heading, "w-40", WIDE)}>Assigned to</th>
          {onDelete && (
            <th scope="col" className="w-11 py-3 pr-3 align-middle">
              <span className="sr-only">Delete</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => {
          const done = t.status === "done";
          const due = dueCell(t, today);
          const priority = taskPriority(t.priority);
          const assignee = t.assigneeId !== undefined ? memberById(t.assigneeId) : undefined;
          return (
            // ink lines between rows, grey under the pointer
            <tr key={t.id} onClick={() => onOpen(t)} className="cursor-pointer border-t border-ink align-middle hover:bg-wash">
              <td className="py-3 pl-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDone(t);
                  }}
                  aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                  aria-pressed={done}
                  className={clsx("hit flex size-6 cursor-pointer items-center justify-center border border-ink", done ? "ink-press border-tint-leaf bg-tint-leaf text-on-action" : "ink-press bg-paper text-ink")}
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
                {t.status === "doing" && <span className={clsx("mt-0.5 block font-serif text-sm text-soft", showStatus && "min-[720px]:hidden")}>In progress</span>}
              </td>
              {showStatus && (
              <td className={clsx(CELL, "py-3", WIDE)}>
                <span
                  className={clsx(
                    "inline-block border px-2 py-0.5 font-sans text-xs font-bold whitespace-nowrap",
                    t.status === "doing" ? "border-tint-warn bg-tint-warn text-on-action" : t.status === "done" ? "border-tint-leaf bg-tint-leaf text-on-action" : "border-ink text-ink",
                  )}
                >
                  {TASK_STATUSES.find((s) => s.key === t.status)?.label}
                </span>
              </td>
              )}
              {showPriority && (
              <td className={clsx(CELL, "py-3")}>
                <span title={priority.label} className="text-lg leading-none">
                  {priority.mark}
                  <span className="sr-only">{priority.label}</span>
                </span>
              </td>
              )}
              <td className={clsx(CELL, "py-3 whitespace-nowrap")}>
                {due ? (
                  <span className={clsx("inline-block border px-2 py-0.5 font-sans text-xs font-bold", due.overdue ? "border-tint-danger bg-tint-danger text-on-action" : "border-ink text-ink")}>
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
                  </span>
                ) : (
                  <span className="text-soft">–</span>
                )}
              </td>
              <td className={clsx(CELL, "py-3", onDelete ? "" : "pr-3", WIDE)}>
                {assignee ? (
                  <span className="flex items-center gap-2 font-serif text-sm text-body">
                    <Avatar member={assignee} size={24} />
                    <span className="truncate">{assignee.name}</span>
                  </span>
                ) : (
                  <span className="font-serif text-sm text-soft">No one yet</span>
                )}
              </td>
              {onDelete && (
                <td className="py-3 pr-3 text-right">
                  <button
                    type="button"
                    title="Delete task"
                    aria-label={`Delete “${t.title}”`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(t);
                    }}
                    className="hit danger-press inline-flex size-6 cursor-pointer items-center justify-center border border-danger bg-paper text-danger"
                  >
                    <TrashIcon className="size-4" aria-hidden />
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
