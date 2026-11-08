import { beforeEach, describe, expect, it } from "vitest";
import { getAppStateForMember } from "./app-state";
import { createInvitation } from "./invitations";
import { sendMessage } from "./messages";
import { proposeNeighborhoodPost } from "./neighborhood-posts";
import { createProposal } from "./proposals";
import { createResource } from "./resources";
import { createTask } from "./tasks";
import { updateMember } from "./members";
import { addCircle, addMember, join, resetDb, setInbox } from "./testing";

/* What reaches a member's browser is exactly what getAppStateForMember hands
   back, so everything private to a circle is checked here, from the viewer's
   side, for a member of it and for someone who isn't. */

const resource = { title: "Shared drive", icon: "file" as const, url: "https://example.test/drive", message: "" };
const task = { title: "Sweep", description: "", status: "todo" as const, priority: "none" as const, dueDate: "", assigneeId: null };

const stateOf = async (id: number) => (await getAppStateForMember(id))!;

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3, 4, 5]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city", name: "The 903" });
  await addCircle("fox", { type: "neighborhood", parentId: "city", name: "Fox Point" });
  await addCircle("council", { type: "circle", parentId: "the903", name: "Council" });
  await addCircle("club", { type: "group", parentId: "city", name: "Club" });
  await join("the903", 1, 2, 3);
  await join("fox", 4);
  await join("council", 1, 2);
  await join("club", 1, 5);
  await setInbox("council");
});

describe("a circle's private things reach only its members", () => {
  it("resources", async () => {
    await createResource(1, "council", resource);
    expect((await stateOf(2)).resources.map((r) => r.title)).toEqual(["Shared drive"]);
    expect((await stateOf(3)).resources).toEqual([]);
    expect((await stateOf(4)).resources).toEqual([]);
  });

  it("tasks, and none at all for a group", async () => {
    await createTask(1, "council", task);
    await expect(createTask(1, "club", task)).rejects.toThrow();
    expect((await stateOf(2)).tasks.map((t) => t.circleId)).toEqual(["council"]);
    expect((await stateOf(3)).tasks).toEqual([]);
    expect((await stateOf(5)).tasks).toEqual([]);
  });

  it("messages written to its Inbox", async () => {
    await sendMessage(3, "council", { subject: "Hello", body: "Is anyone there?", consent: true });
    expect((await stateOf(1)).messages.map((m) => m.subject)).toEqual(["Hello"]);
    expect((await stateOf(2)).messages).toHaveLength(1);
    // not even the sender sees it in the Inbox, which is the members' alone
    expect((await stateOf(3)).messages).toEqual([]);
    expect((await stateOf(4)).messages).toEqual([]);
  });

  it("proposals, but a proposer sees their own", async () => {
    await createProposal(1, "council", { tagline: "We meet on Tuesdays" });
    expect((await stateOf(2)).proposals).toHaveLength(1);
    expect((await stateOf(3)).proposals).toEqual([]);
    expect((await stateOf(4)).proposals).toEqual([]);
  });

  it("invitations: the invitee's own, and a circle's members see the ones it has sent", async () => {
    await createInvitation(1, "council", 3);
    expect((await stateOf(3)).invitations).toHaveLength(1);
    expect((await stateOf(2)).invitations).toHaveLength(1);
    expect((await stateOf(4)).invitations).toEqual([]);
    expect((await stateOf(5)).invitations).toEqual([]);
  });

  it("a group itself, its roster and its events", async () => {
    const asNeighbor = await stateOf(2);
    expect(asNeighbor.circles.map((c) => c.id)).not.toContain("club");
    const asMember = await stateOf(5);
    expect(asMember.circles.find((c) => c.id === "club")?.members.sort()).toEqual([1, 5]);
  });
});

describe("a neighborhood's bulletin", () => {
  it("reaches its residents and the posting circle's members, and no other neighborhood", async () => {
    await addCircle("solo", { type: "circle", parentId: "fox", name: "Solo" });
    await join("solo", 4);
    // a circle of one posts at once
    const { published } = await proposeNeighborhoodPost(4, "solo", { title: "Fox Point news", icon: "announcement", message: "Block party", url: "" });
    expect(published).toBe(true);
    expect((await stateOf(4)).neighborhoodPosts.map((p) => p.title)).toEqual(["Fox Point news"]);
    expect((await stateOf(1)).neighborhoodPosts).toEqual([]);
    expect((await stateOf(5)).neighborhoodPosts).toEqual([]);
  });

  it("holds an unconsented post back from everyone", async () => {
    const { published } = await proposeNeighborhoodPost(1, "council", { title: "Council news", icon: "announcement", message: "Hello", url: "" });
    expect(published).toBe(false);
    expect((await stateOf(1)).neighborhoodPosts).toEqual([]);
    expect((await stateOf(3)).neighborhoodPosts).toEqual([]);
  });
});

describe("members' emails", () => {
  it("are left out for everyone but the owner unless they've made it public", async () => {
    const emailOf = (state: Awaited<ReturnType<typeof stateOf>>, id: number) => state.members.find((m) => m.id === id)?.email;
    expect(emailOf(await stateOf(2), 1)).toBeUndefined();
    expect(emailOf(await stateOf(1), 1)).toBe("m1@example.test");
    await updateMember(1, { emailPublic: true });
    expect(emailOf(await stateOf(2), 1)).toBe("m1@example.test");
    expect(emailOf(await stateOf(2), 3)).toBeUndefined();
  });
});

describe("admin counts", () => {
  it("are null for anyone who isn't an admin", async () => {
    expect((await stateOf(2)).pendingReviews).toBeNull();
  });

  it("returns nothing for a member who no longer exists", async () => {
    expect(await getAppStateForMember(999)).toBeNull();
  });
});
