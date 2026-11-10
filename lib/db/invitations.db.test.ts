import { beforeEach, describe, expect, it } from "vitest";
import { getCircleById } from "./circles";
import { acceptInvitation, createInvitation, deleteInvitation, getInvitationNoticeData, getInvitationsForMember } from "./invitations";
import { addCircle, addMember, join, resetDb, setNotify } from "./testing";

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await join("the903", 1, 2, 3, 4);
  await addCircle("garden", { type: "circle", parentId: "the903", name: "Garden" });
  await join("garden", 1, 2);
  await addCircle("club", { type: "group", parentId: "city", name: "Secret Club" });
  await join("club", 1);
});

describe("inviting", () => {
  it("lets a member invite someone who isn't in the circle", async () => {
    const inv = await createInvitation(1, "garden", 3);
    expect(inv).toMatchObject({ circleId: "garden", memberId: 3, invitedBy: 1, circleName: "Garden" });
  });

  it("refuses a non-member inviting, and anyone inviting to a neighborhood or the city", async () => {
    await expect(createInvitation(3, "garden", 4)).rejects.toThrow(/Only members/);
    await expect(createInvitation(1, "the903", 3)).rejects.toThrow(/don't take invitations/);
    await expect(createInvitation(1, "city", 3)).rejects.toThrow(/don't take invitations/);
    await expect(createInvitation(1, "nope", 3)).rejects.toThrow(/doesn't exist/);
  });

  it("refuses someone who's already in, who's already invited, or who doesn't exist", async () => {
    await expect(createInvitation(1, "garden", 2)).rejects.toThrow(/already a member/);
    await createInvitation(1, "garden", 3);
    await expect(createInvitation(2, "garden", 3)).rejects.toThrow(/already been invited/);
    await expect(createInvitation(1, "garden", 99)).rejects.toThrow(/isn't a member of Circles/);
  });

  it("carries a group's name to the invitee, who can't see the group", async () => {
    await createInvitation(1, "club", 3);
    expect((await getInvitationsForMember(3))[0]).toMatchObject({ circleName: "Secret Club" });
    expect(await getCircleById("club")).not.toBeNull();
  });
});

describe("who is sent an invitation", () => {
  it("sends the invitee theirs and a circle's members its own, and no one else", async () => {
    await createInvitation(1, "garden", 3);
    expect(await getInvitationsForMember(3)).toHaveLength(1);
    expect(await getInvitationsForMember(2)).toHaveLength(1);
    expect(await getInvitationsForMember(1)).toHaveLength(1);
    expect(await getInvitationsForMember(4)).toEqual([]);
  });
});

describe("answering", () => {
  it("joins the invitee to the circle and finishes the invitation on accepting", async () => {
    const { id } = await createInvitation(1, "garden", 3);
    expect(await acceptInvitation(3, id)).toEqual({ circleId: "garden" });
    expect((await getCircleById("garden"))?.members).toContain(3);
    expect(await getInvitationsForMember(3)).toEqual([]);
  });

  it("is the invitee's alone to accept", async () => {
    const { id } = await createInvitation(1, "garden", 3);
    await expect(acceptInvitation(4, id)).rejects.toThrow(/isn't yours/);
    await expect(acceptInvitation(1, id)).rejects.toThrow(/isn't yours/);
    await expect(acceptInvitation(3, "nope")).rejects.toThrow(/doesn't exist/);
    expect((await getCircleById("garden"))?.members).not.toContain(3);
  });

  it("lets the invitee decline and a member delete, but no one else", async () => {
    const a = await createInvitation(1, "garden", 3);
    await deleteInvitation(3, a.id);
    const b = await createInvitation(1, "garden", 3);
    await deleteInvitation(2, b.id);
    const c = await createInvitation(1, "garden", 3);
    await expect(deleteInvitation(4, c.id)).rejects.toThrow(/Only members/);
    await expect(deleteInvitation(1, "nope")).rejects.toThrow(/no longer exists/);
    expect(await getInvitationsForMember(3)).toHaveLength(1);
  });

  it("can be sent again once it's been deleted", async () => {
    const { id } = await createInvitation(1, "garden", 3);
    await deleteInvitation(1, id);
    await expect(createInvitation(1, "garden", 3)).resolves.toBeDefined();
  });
});

describe("the invitee's notice", () => {
  it("names who they are, who invited them and to what", async () => {
    const { id } = await createInvitation(1, "garden", 3);
    expect(await getInvitationNoticeData(id)).toMatchObject({ memberId: 3, email: "m3@example.test", name: "Member 3", inviterName: "Member 1", circleName: "Garden" });
  });

  it("leaves out the address of someone who's turned email off, and is gone with the invitation", async () => {
    await setNotify(3, { email: false });
    const { id } = await createInvitation(1, "garden", 3);
    expect((await getInvitationNoticeData(id))?.email).toBeNull();
    await deleteInvitation(1, id);
    expect(await getInvitationNoticeData(id)).toBeNull();
  });
});
