import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleTasks, circles, members } from "./schema";
import { validateTask, type TaskInput } from "@/lib/tasks.util";
import type { CircleTask } from "@/lib/types";

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

// every task of every circle this member belongs to: AppState's `tasks`
export async function getTasksForMember(memberId: number): Promise<CircleTask[]> {
  const rows = await db
    .select()
    .from(circleTasks)
    .where(inArray(circleTasks.circleId, db.select({ id: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId))));
  return rows.map(toTask);
}

/* The circle's members, if `memberId` is one of them and it's a circle with a
   page (a neighborhood's and the city's members are their residents, too
   many for one backlog); refused otherwise. */
async function membersOf(memberId: number, circleId: string): Promise<number[]> {
  const [circle] = await db.select({ type: circles.type, parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle || circle.type === "neighborhood" || circle.parentId === null) throw new TaskError("That circle doesn't have tasks.");
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
// it, for the caller to tell them
export interface TaskChange {
  task: CircleTask;
  assignedTo: number | null;
}

export async function createTask(memberId: number, circleId: string, input: TaskInput): Promise<TaskChange> {
  const fields = clean(input, await membersOf(memberId, circleId));
  const [row] = await db
    .insert(circleTasks)
    .values({ id: randomUUID(), circleId, createdBy: memberId, ...fields, completedAt: fields.status === "done" ? new Date() : null })
    .returning();
  const task = toTask(row!);
  return { task, assignedTo: task.assigneeId !== undefined && task.assigneeId !== memberId ? task.assigneeId : null };
}

export async function updateTask(memberId: number, id: string, input: TaskInput): Promise<TaskChange> {
  const [existing] = await db.select().from(circleTasks).where(eq(circleTasks.id, id));
  if (!existing) throw new TaskError("That task no longer exists.");
  const fields = clean(input, await membersOf(memberId, existing.circleId));
  // finishing it stamps when; reopening it clears that
  const completedAt = fields.status !== "done" ? null : existing.status === "done" ? existing.completedAt : new Date();
  const [row] = await db.update(circleTasks).set({ ...fields, completedAt, updatedAt: new Date() }).where(eq(circleTasks.id, id)).returning();
  const task = toTask(row!);
  const newlyAssigned = fields.assigneeId !== null && fields.assigneeId !== existing.assigneeId && fields.assigneeId !== memberId;
  return { task, assignedTo: newlyAssigned ? fields.assigneeId : null };
}

export async function deleteTask(memberId: number, id: string): Promise<void> {
  const [existing] = await db.select({ circleId: circleTasks.circleId }).from(circleTasks).where(eq(circleTasks.id, id));
  if (!existing) throw new TaskError("That task no longer exists.");
  await membersOf(memberId, existing.circleId);
  await db.delete(circleTasks).where(eq(circleTasks.id, id));
}

// what an assignment notice needs: the assignee's name and, while they get
// email, their address; who assigned it; the circle's name
export async function getTaskNoticeData(taskId: string, assignerId: number) {
  const [row] = await db
    .select({ title: circleTasks.title, dueDate: circleTasks.dueDate, priority: circleTasks.priority, circleId: circles.id, circleName: circles.name, assigneeId: circleTasks.assigneeId })
    .from(circleTasks)
    .innerJoin(circles, eq(circles.id, circleTasks.circleId))
    .where(eq(circleTasks.id, taskId));
  if (!row || row.assigneeId === null) return null;
  const people = await db.select({ id: members.id, name: members.name, email: members.email, notifyEmail: members.notifyEmail }).from(members).where(inArray(members.id, [row.assigneeId, assignerId]));
  const assignee = people.find((p) => p.id === row.assigneeId);
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
