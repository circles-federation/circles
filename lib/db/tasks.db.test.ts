import { beforeEach, describe, expect, it } from "vitest";
import { leaveCircle } from "./circles";
import { createTask, deleteTask, getTaskNoticeData, getTasksForMember, setTaskStatus, updateTask } from "./tasks";
import { addCircle, addMember, join, resetDb, setNotify } from "./testing";
import type { TaskInput } from "@/lib/tasks.util";

const input = (over: Partial<TaskInput> = {}): TaskInput => ({ title: "Order soil", description: "", status: "todo", priority: "none", dueDate: "", assigneeId: null, ...over });

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await join("the903", 1, 2, 3);
  await addCircle("garden", { type: "circle", parentId: "the903", name: "Garden" });
  await join("garden", 1, 2);
  await addCircle("club", { type: "group", parentId: "city" });
  await join("club", 1);
});

describe("who can see and change a circle's tasks", () => {
  it("sends a member only their circles' tasks", async () => {
    const { task } = await createTask(1, "garden", input());
    expect((await getTasksForMember(2)).map((t) => t.id)).toEqual([task.id]);
    expect(await getTasksForMember(3)).toEqual([]);
  });

  it("refuses a non-member every write, and says nothing of the task", async () => {
    const { task } = await createTask(1, "garden", input());
    await expect(createTask(3, "garden", input())).rejects.toThrow(/members/);
    await expect(updateTask(3, task.id, input({ title: "Hijacked" }))).rejects.toThrow(/members/);
    await expect(setTaskStatus(3, task.id, "done")).rejects.toThrow(/members/);
    await expect(deleteTask(3, task.id)).rejects.toThrow(/members/);
    expect((await getTasksForMember(1))[0]?.title).toBe("Order soil");
  });

  it("has no backlog for a group, a neighborhood or the city", async () => {
    for (const id of ["club", "the903", "city"]) await expect(createTask(1, id, input())).rejects.toThrow(/doesn't have tasks/);
  });

  it("lets any member change or delete any task of the circle", async () => {
    const { task } = await createTask(1, "garden", input());
    expect((await updateTask(2, task.id, input({ title: "Order compost" }))).task.title).toBe("Order compost");
    await deleteTask(2, task.id);
    expect(await getTasksForMember(1)).toEqual([]);
  });

  it("says a task has gone rather than failing obscurely", async () => {
    for (const run of [() => updateTask(1, "nope", input()), () => setTaskStatus(1, "nope", "done"), () => deleteTask(1, "nope")]) await expect(run()).rejects.toThrow(/no longer exists/);
  });
});

describe("what a task may hold", () => {
  it("refuses an invalid task and an assignee outside the circle", async () => {
    await expect(createTask(1, "garden", input({ title: "  " }))).rejects.toThrow();
    await expect(createTask(1, "garden", input({ assigneeId: 3 }))).rejects.toThrow();
  });

  it("trims the title and turns an empty due date into none", async () => {
    const { task } = await createTask(1, "garden", input({ title: "  Order soil  " }));
    expect(task.title).toBe("Order soil");
    expect(task.dueDate).toBeUndefined();
  });
});

describe("finishing a task", () => {
  it("stamps when it's done, keeps that while it stays done, and clears it on reopening", async () => {
    const { task } = await createTask(1, "garden", input());
    const done = await setTaskStatus(1, task.id, "done");
    expect(done.completedAt).toBeDefined();
    const stayed = await updateTask(2, task.id, input({ status: "done", title: "Renamed" }));
    expect(stayed.task.completedAt).toBe(done.completedAt);
    expect((await setTaskStatus(1, task.id, "doing")).completedAt).toBeUndefined();
  });

  it("stamps a task created already done, and refuses a status that doesn't exist", async () => {
    const { task } = await createTask(1, "garden", input({ status: "done" }));
    expect(task.completedAt).toBeDefined();
    await expect(setTaskStatus(1, task.id, "bogus" as never)).rejects.toThrow(/where the task stands/);
  });

  it("changes only the status, never the title or assignee", async () => {
    const { task } = await createTask(1, "garden", input({ assigneeId: 2 }));
    const after = await setTaskStatus(1, task.id, "doing");
    expect([after.title, after.assigneeId, after.status]).toEqual(["Order soil", 2, "doing"]);
  });
});

describe("assigning", () => {
  it("reports who to tell only when it's given to someone other than who did it", async () => {
    expect((await createTask(1, "garden", input({ assigneeId: 1 }))).assignedTo).toBeNull();
    const { task, assignedTo, assignedBy } = await createTask(1, "garden", input({ assigneeId: 2 }));
    expect([assignedTo, assignedBy]).toEqual([2, 1]);
    // saved again unchanged: nothing new to say
    expect((await updateTask(1, task.id, input({ assigneeId: 2 }))).assignedTo).toBeNull();
    // taking it back for themself isn't news either
    expect((await updateTask(2, task.id, input({ assigneeId: 2 }))).assignedTo).toBeNull();
  });

  it("builds a notice for the assignment a save made, and none once it's changed hands", async () => {
    const { task } = await createTask(1, "garden", input({ assigneeId: 2 }));
    const notice = await getTaskNoticeData(task.id, 2, 1);
    expect(notice).toMatchObject({ memberId: 2, name: "Member 2", assignerName: "Member 1", circleName: "Garden", email: "m2@example.test" });
    await updateTask(1, task.id, input({ assigneeId: 1 }));
    expect(await getTaskNoticeData(task.id, 2, 1)).toBeNull();
    expect(await getTaskNoticeData("nope", 2, 1)).toBeNull();
  });

  it("leaves out the address of someone who's turned email off", async () => {
    await setNotify(2, { email: false });
    const { task } = await createTask(1, "garden", input({ assigneeId: 2 }));
    expect(await getTaskNoticeData(task.id, 2, 1)).not.toHaveProperty("email");
  });

  it("lets go of a member's tasks when they leave the circle", async () => {
    const { task } = await createTask(1, "garden", input({ assigneeId: 2 }));
    await leaveCircle(2, "garden");
    expect((await getTasksForMember(1)).find((t) => t.id === task.id)?.assigneeId).toBeUndefined();
  });
});
