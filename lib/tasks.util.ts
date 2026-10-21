import { MONTHS, WEEKDAYS, parseDay } from "./format.util";
import type { CircleTask, TaskPriority, TaskStatus } from "./types";

/* A circle's backlog (lib/db/tasks.ts): the rules the form, the lists and the
   server share. A task is to do, in progress or done; the back burner isn't a
   state of its own but a to-do with the lowest priority, zzz. */

export const TASK_TITLE_MAX = 140;
export const TASK_DESCRIPTION_MAX = 4000;

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "In progress" },
  { key: "done", label: "Done" },
];

// highest first; `mark` is how it's written everywhere, `label` what it means
export const TASK_PRIORITIES: { key: TaskPriority; mark: string; label: string }[] = [
  { key: "urgent", mark: "!!!", label: "Urgent" },
  { key: "high", mark: "!!", label: "High" },
  { key: "normal", mark: "!", label: "Normal" },
  { key: "none", mark: "–", label: "No priority" },
  { key: "someday", mark: "zzz", label: "Back burner" },
];

export const taskPriority = (key: TaskPriority) => TASK_PRIORITIES.find((p) => p.key === key) ?? TASK_PRIORITIES[3]!;
const rank = (key: TaskPriority) => TASK_PRIORITIES.findIndex((p) => p.key === key);

// what the form sends; an empty due date or assignee is none
export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: number | null;
}

export type TaskErrors = Partial<Record<keyof TaskInput, string>>;

/* What's wrong with a task, field by field: the form's instant feedback, and
   the server's real check (which also passes the circle's members, since an
   assignee must be one). */
export function validateTask(input: TaskInput, memberIds: number[]): TaskErrors {
  const errors: TaskErrors = {};
  const title = input.title.trim();
  if (!title) errors.title = "Give the task a title.";
  else if (title.length > TASK_TITLE_MAX) errors.title = `Keep the title under ${TASK_TITLE_MAX} characters.`;
  if (input.description.trim().length > TASK_DESCRIPTION_MAX) errors.description = `Keep the description under ${TASK_DESCRIPTION_MAX} characters.`;
  if (!TASK_STATUSES.some((s) => s.key === input.status)) errors.status = "Choose where the task stands.";
  if (!TASK_PRIORITIES.some((p) => p.key === input.priority)) errors.priority = "Choose a priority.";
  if (input.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || isNaN(parseDay(input.dueDate).getTime()))) errors.dueDate = "That date wasn't recognized.";
  if (input.assigneeId !== null && !memberIds.includes(input.assigneeId)) errors.assigneeId = "Assign it to one of the circle's members.";
  return errors;
}

/* A list's order: most pressing first (by priority, then the soonest due,
   with no date after any date), then the oldest. Done tasks go most recently
   finished first. */
export function sortTasks(tasks: CircleTask[]): CircleTask[] {
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status === "done") return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
    return (
      rank(a.priority) - rank(b.priority) ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      a.createdAt.localeCompare(b.createdAt)
    );
  });
}

// the back burner: to-dos of priority zzz, kept apart from the live list
export const onBackBurner = (t: CircleTask) => t.status === "todo" && t.priority === "someday";

/* When it's due, as a list says it: "Due today", "Due tomorrow", "Due Fri,
   Oct 24", or "Overdue · Oct 20" once its day has passed (a done task is never
   overdue). `today` is the wall-clock date, YYYY-MM-DD. */
export function dueLabel(t: Pick<CircleTask, "dueDate" | "status">, today: string): { text: string; overdue: boolean } | null {
  if (!t.dueDate) return null;
  const day = parseDay(t.dueDate);
  const date = `${MONTHS[day.getMonth()]} ${day.getDate()}`;
  if (t.status !== "done" && t.dueDate < today) return { text: `Overdue · ${date}`, overdue: true };
  if (t.dueDate === today) return { text: "Due today", overdue: false };
  const tomorrow = parseDay(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (day.getTime() === tomorrow.getTime()) return { text: "Due tomorrow", overdue: false };
  return { text: `Due ${WEEKDAYS[day.getDay()]}, ${date}`, overdue: false };
}
