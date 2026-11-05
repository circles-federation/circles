import { describe, expect, it } from "vitest";
import { dueCell, dueLabel, onBackBurner, sortTasks, taskPriority, validateTask, type TaskInput } from "./tasks.util";
import type { CircleTask } from "./types";

const input = (over: Partial<TaskInput> = {}): TaskInput => ({ title: "Paint", description: "", status: "todo", priority: "none", dueDate: "", assigneeId: null, ...over });
const task = (over: Partial<CircleTask> = {}): CircleTask => ({ id: "t", circleId: "c", title: "Paint", description: "", status: "todo", priority: "none", createdAt: "", updatedAt: "", ...over });

describe("validateTask", () => {
  it("accepts a bare task", () => expect(validateTask(input(), [1])).toEqual({}));
  it("needs a title within the limit", () => {
    expect(validateTask(input({ title: " " }), []).title).toBeDefined();
    expect(validateTask(input({ title: "x".repeat(141) }), []).title).toBeDefined();
  });
  it("limits the description", () => expect(validateTask(input({ description: "x".repeat(4001) }), []).description).toBeDefined());
  it("status and priority must be known", () => {
    expect(validateTask(input({ status: "blocked" as never }), []).status).toBeDefined();
    expect(validateTask(input({ priority: "p0" as never }), []).priority).toBeDefined();
  });
  it("a due date must be a real day, or empty", () => {
    expect(validateTask(input({ dueDate: "2026-11-10" }), [])).toEqual({});
    expect(validateTask(input({ dueDate: "11/10/2026" }), []).dueDate).toBeDefined();
    expect(validateTask(input({ dueDate: "2026-13-45" }), []).dueDate).toBeDefined();
    expect(validateTask(input({ dueDate: "2026-02-31" }), []).dueDate).toBeDefined();
  });
  it("the assignee must be one of the circle's members", () => {
    expect(validateTask(input({ assigneeId: 1 }), [1, 2])).toEqual({});
    expect(validateTask(input({ assigneeId: 9 }), [1, 2]).assigneeId).toBeDefined();
  });
  it("reports every problem at once", () => {
    expect(Object.keys(validateTask(input({ title: "", dueDate: "x", assigneeId: 9 }), [])).sort()).toEqual(["assigneeId", "dueDate", "title"]);
  });
});

describe("priorities", () => {
  it("Normal shows nothing and the back burner sleeps", () => {
    expect(taskPriority("none").mark).toBe("");
    expect(taskPriority("someday").mark).toBe("💤");
  });
  it("an unknown priority is Normal", () => expect(taskPriority("zzz" as never).key).toBe("none"));
  it("only a to-do of the lowest priority is on the back burner", () => {
    expect(onBackBurner(task({ priority: "someday" }))).toBe(true);
    expect(onBackBurner(task({ priority: "someday", status: "doing" }))).toBe(false);
    expect(onBackBurner(task({ priority: "someday", status: "done" }))).toBe(false);
    expect(onBackBurner(task())).toBe(false);
  });
});

describe("sortTasks", () => {
  const ids = (tasks: CircleTask[]) => sortTasks(tasks).map((t) => t.id);
  it("soonest due first, undated last", () => {
    expect(ids([task({ id: "none" }), task({ id: "late", dueDate: "2026-12-01" }), task({ id: "soon", dueDate: "2026-11-02" })])).toEqual(["soon", "late", "none"]);
  });
  it("then the most pressing", () => {
    expect(ids([task({ id: "low", priority: "someday" }), task({ id: "crit", priority: "urgent" }), task({ id: "normal" }), task({ id: "med", priority: "normal" })])).toEqual(["crit", "med", "normal", "low"]);
  });
  it("then by name, ignoring case", () => {
    expect(ids([task({ id: "b", title: "banana" }), task({ id: "a", title: "Apple" })])).toEqual(["a", "b"]);
  });
  it("doesn't mutate its input", () => {
    const list = [task({ id: "b", title: "b" }), task({ id: "a", title: "a" })];
    sortTasks(list);
    expect(list.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("dueCell / dueLabel", () => {
  const today = "2026-11-10";
  it("is null with no date", () => {
    expect(dueCell(task(), today)).toBeNull();
    expect(dueLabel(task(), today)).toBeNull();
  });
  it("Today and Tomorrow", () => {
    expect(dueCell(task({ dueDate: today }), today)).toEqual({ text: "Today", overdue: false });
    expect(dueCell(task({ dueDate: "2026-11-11" }), today)).toEqual({ text: "Tomorrow", overdue: false });
  });
  it("tomorrow across a month end", () => {
    expect(dueCell(task({ dueDate: "2026-12-01" }), "2026-11-30")?.text).toBe("Tomorrow");
  });
  it("a later day with its weekday", () => {
    expect(dueCell(task({ dueDate: "2026-11-13" }), today)).toEqual({ text: "Fri, Nov 13", overdue: false });
  });
  it("overdue once the day has passed, unless it's done", () => {
    expect(dueCell(task({ dueDate: "2026-11-09" }), today)).toEqual({ text: "Nov 9", overdue: true });
    expect(dueCell(task({ dueDate: "2026-11-09", status: "done" }), today)).toEqual({ text: "Mon, Nov 9", overdue: false });
  });
  it("a sentence for the notice", () => {
    expect(dueLabel(task({ dueDate: today }), today)).toEqual({ text: "Due today", overdue: false });
    expect(dueLabel(task({ dueDate: "2026-11-11" }), today)).toEqual({ text: "Due tomorrow", overdue: false });
    expect(dueLabel(task({ dueDate: "2026-11-13" }), today)).toEqual({ text: "Due Fri, Nov 13", overdue: false });
    expect(dueLabel(task({ dueDate: "2026-11-01" }), today)).toEqual({ text: "Overdue · Nov 1", overdue: true });
  });
});
