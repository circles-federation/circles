import { beforeEach, describe, expect, it } from "vitest";
import { getCircleById, getCirclesForMember, updateCircle } from "./circles";
import { getMemberById, updateMember } from "./members";
import { addCircle, addMember, circleArchived, circleEditor, join, resetDb } from "./testing";

/* What a member may write straight to a circle's page or their own profile:
   only the fields those forms have, attributed by the server, and small enough
   that it can be sent to every other member's browser. */

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("council", { type: "circle", parentId: "city", name: "Council" });
  await join("council", 1, 2);
});

describe("editing a circle's page", () => {
  it("writes the wiki fields, attributed to whoever made the edit, whatever the request claims", async () => {
    const before = Date.now();
    await updateCircle(2, "council", { about: "We meet monthly", lastEditedBy: 3, lastEditedAt: "2001-01-01T00:00:00Z" });
    const circle = await getCircleById("council");
    expect(circle?.about).toBe("We meet monthly");
    const editor = await circleEditor("council");
    expect(editor.by).toBe(2);
    expect(editor.at!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("ignores columns that aren't the wiki's, such as archiving or the id", async () => {
    await updateCircle(2, "council", { archivedAt: "2026-01-01T00:00:00Z", id: "hijacked", about: "Fine" } as never);
    expect(await circleArchived("council")).toBe(false);
    expect((await getCirclesForMember(1)).map((c) => c.id)).toContain("council");
    expect((await getCircleById("council"))?.about).toBe("Fine");
  });

  it("refuses text too big to send to everyone", async () => {
    await expect(updateCircle(2, "council", { about: "x".repeat(20_000) })).rejects.toThrow(/too long|Keep/);
    await expect(updateCircle(2, "council", { offers: Array.from({ length: 200 }, () => "food") })).rejects.toThrow(/too many|Keep/);
    await expect(updateCircle(2, "council", { website: "x".repeat(5000) })).rejects.toThrow(/Keep/);
    await expect(updateCircle(2, "council", { facts: Array.from({ length: 100 }, () => ["a", "b"] as [string, string]) })).rejects.toThrow(/Keep/);
    expect((await getCircleById("council"))?.about).toBe("");
  });
});

describe("editing your own profile", () => {
  it("refuses a name, bio or tags too big to send to everyone", async () => {
    await expect(updateMember(1, { name: "x".repeat(500) })).rejects.toThrow(/Keep/);
    await expect(updateMember(1, { lastName: "x".repeat(500) })).rejects.toThrow(/Keep/);
    await expect(updateMember(1, { bio: "x".repeat(50_000) })).rejects.toThrow(/Keep/);
    await expect(updateMember(1, { skills: Array.from({ length: 500 }, (_, i) => `skill ${i}`) })).rejects.toThrow(/Keep/);
    await expect(updateMember(1, { interests: ["x".repeat(500)] })).rejects.toThrow(/Keep/);
    expect((await getMemberById(1))?.bio).toBe("");
  });

  it("still takes a normal profile", async () => {
    await updateMember(1, { name: "Ona", lastName: "Park", bio: "Hi, I garden.", skills: ["carpentry"], interests: ["bikes"] });
    expect(await getMemberById(1)).toMatchObject({ name: "Ona", bio: "Hi, I garden.", skills: ["carpentry"] });
  });

  it("refuses a blank name", async () => {
    await expect(updateMember(1, { name: "   " })).rejects.toThrow(/name/i);
  });
});
