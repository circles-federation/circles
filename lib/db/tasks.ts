import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { circleHasTasks } from "@/lib/circles.util";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleTasks, circles, members } from "./schema";
import { TASK_STATUSES, validateTask, type TaskInput } from "@/lib/tasks.util";
import type { CircleTask, TaskStatus } from "@/lib/types";

/* A circle's backlog, its members' alone: this file is where that's held to.
   A member is only ever sent the tasks of circles they belong to, and every
   write checks they belong to the task's circle and validates it again. Any
   member can add, change, assign, move or delete any of its tasks, saved
   straight away: day-to-day work, not something the circle decides by
   consent. Like the rest of lib/db, it takes the acting member's id and never
   reads the session itself. */

export class TaskError extends UserFacingError {}

type TaskRow = typeof circleTasks.$inferSelect;

function toTask(row: TaskRow): CircleTask {
  return {
    id: row.id,
    circleId: row.circleId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    ...(row.dueDate !== null ? { dueDate: row.dueDate } : {}),
    ...(row.assigneeId !== null ? { assigneeId: row.assigneeId } : {}),
    ...(row.createdBy !== null ? { createdBy: row.createdBy } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
  };
}

// every task of every circle this member belongs to that has tasks (never a
// group's): AppState's `tasks`
export async function getTasksForMember(memberId: number): Promise<CircleTask[]> {
  const rows = await db
    .select({ task: circleTasks })
    .from(circleTasks)
    .innerJoin(circles, eq(circles.id, circleTasks.circleId))
    .where(and(inArray(circleTasks.circleId, db.select({ id: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId))), ne(circles.type, "group")));
  return rows.map((r) => toTask(r.task));
}

/* The circle's members, if `memberId` is one of them and it's a circle with
   tasks (circleHasTasks: not a neighborhood or the city, whose members are
   their residents, too many for one backlog, nor a group); refused otherwise. */
async function membersOf(memberId: number, circleId: string): Promise<number[]> {
  const [circle] = await db.select({ type: circles.type, parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle || !circleHasTasks(circle)) throw new TaskError("That circle doesn't have tasks.");
  const ids = (await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((r) => r.id);
  if (!ids.includes(memberId)) throw new TaskError("Only the circle's members can see or change its tasks.");
  return ids;
}

function clean(input: TaskInput, memberIds: number[]) {
  const first = Object.values(validateTask(input, memberIds))[0];
  if (first) throw new TaskError(first);
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate || null,
    assigneeId: input.assigneeId,
  };
}

// a task, and whether it's just been given to someone other than whoever did
// it (`assignedBy`), for the caller to tell them
export interface TaskChange {
  task: CircleTask;
  assignedTo: number | null;
  assignedBy: number;
}

export async function createTask(memberId: number, circleId: string, input: TaskInput): Promise<TaskChange> {
  const fields = clean(input, await membersOf(memberId, circleId));
  const [row] = await db
    .insert(circleTasks)
    .values({ id: randomUUID(), circleId, createdBy: memberId, ...fields, completedAt: fields.status === "done" ? new Date() : null })
    .returning();
  const task = toTask(row!);
  return { task, assignedTo: task.assigneeId !== undefined && task.assigneeId !== memberId ? task.assigneeId : null, assignedBy: memberId };
}

// finishing it stamps when; reopening it clears that; staying done keeps it
const completedAtFor = (status: TaskStatus, existing: { status: TaskStatus; completedAt: Date | null }) =>
  status !== "done" ? null : existing.status === "done" ? existing.completedAt : new Date();

/* Save the task as the form has it. Locked while it's read and written, so
   a save landing at the same moment as another can't work from a row the
   other has changed: whether it's finished, and whether this save is what
   gave it to someone, are decided against the row as it stands. */
export async function updateTask(memberId: number, id: string, input: TaskInput): Promise<TaskChange> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(circleTasks).where(eq(circleTasks.id, id)).for("update");
    if (!existing) throw new TaskError("That task no longer exists.");
    const fields = clean(input, await membersOf(memberId, existing.circleId));
    const [row] = await tx
      .update(circleTasks)
      .set({ ...fields, completedAt: completedAtFor(fields.status, existing), updatedAt: new Date() })
      .where(eq(circleTasks.id, id))
      .returning();
    const newlyAssigned = fields.assigneeId !== null && fields.assigneeId !== existing.assigneeId && fields.assigneeId !== memberId;
    return { task: toTask(row!), assignedTo: newlyAssigned ? fields.assigneeId : null, assignedBy: memberId };
  });
}

/* Only its status: the table's round button, marking it done or reopening it.
   Nothing else is sent, so it can't put back an older title or assignee from
   a copy of the task that's out of date. Locked like a save. */
export async function setTaskStatus(memberId: number, id: string, status: TaskStatus): Promise<CircleTask> {
  if (!TASK_STATUSES.some((s) => s.key === status)) throw new TaskError("Choose where the task stands.");
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(circleTasks).where(eq(circleTasks.id, id)).for("update");
    if (!existing) throw new TaskError("That task no longer exists.");
    await membersOf(memberId, existing.circleId);
    const [row] = await tx
      .update(circleTasks)
      .set({ status, completedAt: completedAtFor(status, existing), updatedAt: new Date() })
      .where(eq(circleTasks.id, id))
      .returning();
    return toTask(row!);
  });
}

export async function deleteTask(memberId: number, id: string): Promise<void> {
  const [existing] = await db.select({ circleId: circleTasks.circleId }).from(circleTasks).where(eq(circleTasks.id, id));
  if (!existing) throw new TaskError("That task no longer exists.");
  await membersOf(memberId, existing.circleId);
  await db.delete(circleTasks).where(eq(circleTasks.id, id));
}

/* What an assignment notice needs, for the assignment a save made (who it
   gave the task to, and who did): the assignee's name and, while they get
   email, their address; the assigner's name; the circle's name. Null if the
   task has gone, or been given to someone else since, who'll have been told
   by that save instead. */
export async function getTaskNoticeData(taskId: string, assigneeId: number, assignerId: number) {
  const [row] = await db
    .select({ title: circleTasks.title, dueDate: circleTasks.dueDate, priority: circleTasks.priority, circleId: circles.id, circleName: circles.name, assigneeId: circleTasks.assigneeId })
    .from(circleTasks)
    .innerJoin(circles, eq(circles.id, circleTasks.circleId))
    .where(eq(circleTasks.id, taskId));
  if (!row || row.assigneeId !== assigneeId) return null;
  const people = await db.select({ id: members.id, name: members.name, email: members.email, notifyEmail: members.notifyEmail }).from(members).where(inArray(members.id, [assigneeId, assignerId]));
  const assignee = people.find((p) => p.id === assigneeId);
  const assigner = people.find((p) => p.id === assignerId);
  if (!assignee) return null;
  return {
    ...row,
    memberId: assignee.id,
    name: assignee.name,
    ...(assignee.email && assignee.notifyEmail ? { email: assignee.email } : {}),
    ...(assigner ? { assignerName: assigner.name } : {}),
  };
}

// a member who leaves a circle no longer holds its tasks (leaveCircle)
export async function unassignFromCircle(tx: Pick<typeof db, "update">, memberId: number, circleId: string): Promise<void> {
  await tx.update(circleTasks).set({ assigneeId: null, updatedAt: new Date() }).where(and(eq(circleTasks.circleId, circleId), eq(circleTasks.assigneeId, memberId)));
}
