import { beforeEach, describe, expect, it } from "vitest";
import { getCircleById, getCirclesForMember, getPublicWiki } from "./circles";
import { createEvent } from "./events";
import { createProposal } from "./proposals";
import { createTask, getTasksForMember } from "./tasks";
import { addCircle, addMember, join, resetDb } from "./testing";
import type { EventDraft } from "@/lib/events.util";
import type { TaskInput } from "@/lib/tasks.util";

const task: TaskInput = { title: "Bring chairs", description: "", status: "todo", priority: "none", dueDate: "", assigneeId: null };
const meeting = { kind: "meeting" } as Pick<EventDraft, "kind">;

beforeEach(async () => {
  await resetDb();
  await addMember(1);
  await addCircle("city", { type: "other" });
  await addCircle("club", { type: "group", parentId: "city" });
  await join("club", 1);
});

describe("a group's features", () => {
  it("start off, and its members switch them on by consent", async () => {
    expect((await getCircleById("club"))?.features).toBeUndefined();
    await expect(createTask(1, "club", task)).rejects.toThrow(/doesn't have tasks/);

    // a group of one decides it at once
    const { circle } = await createProposal(1, "club", { features: ["tasks", "wiki"] });
    expect(circle?.features).toEqual(["wiki", "tasks"]);
    expect((await createTask(1, "club", task)).task.title).toBe("Bring chairs");
    expect((await getTasksForMember(1)).map((t) => t.title)).toEqual(["Bring chairs"]);
  });

  it("turning one off hides it again", async () => {
    await createProposal(1, "club", { features: ["tasks"] });
    await createProposal(1, "club", { features: [] });
    await expect(createTask(1, "club", task)).rejects.toThrow(/doesn't have tasks/);
  });

  it("only a group has them", async () => {
    await addCircle("council", { type: "circle", parentId: "city" });
    await join("council", 1);
    await expect(createProposal(1, "council", { features: ["wiki"] })).rejects.toThrow(/Only a group/);
  });

  it("never make a group's wiki public", async () => {
    await createProposal(1, "club", { features: ["wiki"] });
    expect(await getPublicWiki("club")).toBeNull();
  });

  it("let it hold meetings once they're on", async () => {
    const draft = { circleId: "club", title: "Meet", date: "2099-01-01", start: "10:00", end: "11:00", location: "Here", description: "", agenda: [{ title: "Hi", category: "report" }], ...meeting } as unknown as EventDraft;
    await expect(createEvent(1, draft)).rejects.toThrow(/hasn't turned on meetings/);
    await createProposal(1, "club", { features: ["meetings"] });
    await expect(createEvent(1, draft)).resolves.toBeDefined();
  });

  it("can be made public by consent, and private again", async () => {
    await addMember(2);
    const ids = async (memberId: number) => (await getCirclesForMember(memberId)).map((c) => c.id);
    expect(await ids(2)).not.toContain("club");

    expect((await createProposal(1, "club", { public: true })).circle?.public).toBe(true);
    expect(await ids(2)).toContain("club");
    // public, a group can have an Inbox and a public wiki
    await createProposal(1, "club", { features: ["wiki"] });
    expect((await getPublicWiki("club"))?.name).toBe("club");

    await createProposal(1, "club", { public: false });
    expect(await ids(2)).not.toContain("club");
    expect(await getPublicWiki("club")).toBeNull();
  });

  it("can't be made private while it has circles inside", async () => {
    await createProposal(1, "club", { public: true });
    await addCircle("inner", { type: "circle", parentId: "club" });
    await join("inner", 1);
    await expect(createProposal(1, "club", { public: false })).rejects.toThrow(/circles inside/);
  });
});
