import { beforeEach, describe, expect, it, vi } from "vitest";

/* The server actions are the browser's only way to write, so what they're
   allowed to do depends on the session alone: each one acts as the signed-in
   member and none takes who from the caller. The session is the one thing
   faked here (and the things that run after a response: emails and pushes). */

const session = vi.hoisted(() => ({ memberId: null as number | null }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: async () => session.memberId }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/notify", () => ({
  deliverAnnouncementNotifications: vi.fn(),
  deliverEventNotifications: vi.fn(),
  deliverProposalNotifications: vi.fn(),
  pushToMember: vi.fn(async () => 0),
  tellCircleOfChat: vi.fn(),
  tellCircleOfMessage: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

import * as actions from "./actions";
import * as chat from "./chat";
import { getCircleById } from "./circles";
import { addCircle, addMember, join, memberName, resetDb, tableCounts } from "./testing";

const photo = () => {
  const form = new FormData();
  form.set("photo", new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])]));
  return form;
};
const draft = { title: "Party", kind: "ordinary", circleId: "city", date: "2099-01-01", start: "10:00", end: "11:00", location: "x", description: "" };
const task = { title: "Do it", description: "", status: "todo" as const, priority: "none" as const, dueDate: "", assigneeId: null };
const resource = { title: "Doc", icon: "file" as const, url: "https://example.test", message: "" };

// every exported action, with arguments it could be called with. A new action
// must be added here, which is the point: it can't ship without being checked.
const CALLS: Record<string, unknown[]> = {
  updateMemberAction: [{ name: "Hacked" }],
  saveNotificationSettingsAction: [{ email: false, push: false }],
  saveAvailabilityAction: [[]],
  meetingAvailabilityAction: ["council", "2099-01-01", "10:00", "11:00"],
  updateMemberPhotoAction: [photo()],
  loadAppStateAction: [],
  createCircleAction: [{ type: "collective", name: "New", tagline: "", parentId: "city" }],
  createProposalAction: ["council", { name: "Renamed" }],
  withdrawProposalAction: ["x"],
  proposeMessageRemovalAction: [1],
  respondToProposalAction: ["x", "like"],
  updateCircleAction: ["council", { about: "Hacked" }],
  sendChatMessageAction: ["council", { body: "hi", mentions: [] }],
  setChatViewingAction: ["client", ["council"]],
  editChatMessageAction: [1, "hi"],
  deleteChatMessageAction: [1],
  getChatMessagesAction: ["council"],
  getChatUnreadAction: [],
  markChatReadAction: ["council", 1],
  proposeNeighborhoodPostAction: ["the903", resource],
  removeNeighborhoodPostAction: ["x"],
  createResourceAction: ["council", resource],
  updateResourceAction: ["x", resource],
  deleteResourceAction: ["x"],
  createShareLinkAction: ["x"],
  getShareStatusAction: ["x"],
  revokeShareLinksAction: ["x", "all"],
  createEventAction: [draft],
  updateEventDetailsAction: ["x", { ...draft, roles: [], reminders: [24] }],
  cancelEventAction: ["x"],
  setRsvpAction: ["x", true],
  toggleRoleSlotAction: ["x", "cook"],
  approveApplicationAction: ["x"],
  declineApplicationAction: ["x", ""],
  approvePhotoAction: [2, 1],
  declinePhotoAction: [2, 1, ""],
  createTaskAction: ["council", task],
  updateTaskAction: ["x", task],
  setTaskStatusAction: ["x", "done"],
  deleteTaskAction: ["x"],
  sendCircleMessageAction: ["council", { subject: "Hi", body: "Hello", consent: true }],
  markMessageReadAction: ["x"],
  assignMessageAction: ["x", 2],
  setMessageDoneAction: ["x", true],
  createInvitationAction: ["council", 3],
  leaveCircleAction: ["council"],
  acceptInvitationAction: ["x"],
  deleteInvitationAction: ["x"],
  savePushSubscriptionAction: [{ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "k", auth: "a" } }],
  deletePushSubscriptionAction: ["https://fcm.googleapis.com/x"],
  sendTestPushAction: [],
  startMeetingAction: ["x"],
  setMeetingStepAction: ["x", 1],
  takeOverMeetingAction: ["x"],
  addMeetingTopicAction: ["x", { category: "explore", title: "More" }],
  removeMeetingTopicAction: ["x", 0],
  setMeetingPresentAction: ["x", 1, true],
  saveMeetingNotesAction: ["x", 0, "notes"],
  finishMeetingAction: ["x"],
};

const call = (name: string) => (actions as unknown as Record<string, (...args: unknown[]) => Promise<{ ok: boolean }>>)[name]!(...CALLS[name]!);

beforeEach(async () => {
  session.memberId = null;
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await addCircle("council", { type: "circle", parentId: "the903", name: "Council" });
  await join("the903", 1, 2, 3);
  await join("council", 1, 2);
});

describe("every action", () => {
  it("is listed here, so a new one can't be added without being checked", () => {
    expect(Object.keys(CALLS).sort()).toEqual(Object.keys(actions).sort());
  });

  it("refuses someone who isn't signed in, and writes nothing", async () => {
    const before = await tableCounts();
    for (const name of Object.keys(CALLS)) {
      const result = await call(name);
      expect(result.ok, name).toBe(false);
    }
    expect(await tableCounts()).toEqual(before);
    expect(await actions.loadAppStateAction()).toEqual({ ok: false, signedOut: true });
  });
});

describe("acting as the signed-in member", () => {
  it("writes only that member's own profile, whatever the patch says", async () => {
    session.memberId = 2;
    const result = await actions.updateMemberAction({ name: "Pat", id: 1, email: "x@example.test" } as never);
    expect(result.ok).toBe(true);
    expect(await memberName(2)).toBe("Pat");
    expect(await memberName(1)).toBe("Member 1");
  });

  it("refuses an outsider's write to a circle, and a member's edit of what's consent-only", async () => {
    session.memberId = 3;
    expect((await actions.updateCircleAction("council", { about: "Hacked" })).ok).toBe(false);
    session.memberId = 2;
    expect((await actions.updateCircleAction("council", { about: "Fine" })).ok).toBe(true);
    // its name is the circle's to change by consent, never straight through here
    expect((await actions.updateCircleAction("council", { name: "Renamed" })).ok).toBe(false);
    expect((await getCircleById("council"))?.name).toBe("Council");
  });

  it("keeps a circle's bulletin, tasks and chat to its members", async () => {
    session.memberId = 3;
    expect((await actions.createResourceAction("council", resource)).ok).toBe(false);
    expect((await actions.createTaskAction("council", task)).ok).toBe(false);
    expect((await actions.sendChatMessageAction("council", { body: "hi", mentions: [] })).ok).toBe(false);
    expect((await actions.getChatMessagesAction("council")).ok).toBe(false);
    session.memberId = 2;
    expect((await actions.createResourceAction("council", resource)).ok).toBe(true);
    expect((await actions.sendChatMessageAction("council", { body: "hi", mentions: [] })).ok).toBe(true);
  });

  it("keeps review to system admins", async () => {
    session.memberId = 2;
    expect((await actions.approveApplicationAction("x")).ok).toBe(false);
    expect((await actions.approvePhotoAction(3, 1)).ok).toBe(false);
    expect((await actions.declinePhotoAction(3, 1, "")).ok).toBe(false);
  });

  it("won't send a test push in production", async () => {
    session.memberId = 2;
    vi.stubEnv("NODE_ENV", "production");
    expect(await actions.sendTestPushAction()).toEqual({ ok: false, error: "Not available." });
    vi.unstubAllEnvs();
  });
});

describe("what an action says when it fails", () => {
  it("passes on a refusal's own words, and hides anything unexpected", async () => {
    session.memberId = 3;
    const refused = await actions.createResourceAction("council", resource);
    expect(refused).toMatchObject({ ok: false });
    expect((refused as { error: string }).error).not.toMatch(/Something went wrong/);
    session.memberId = 2;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(chat, "getChatUnread").mockRejectedValue(new Error("connection to 10.0.0.5 refused, password=hunter2"));
    expect(await actions.getChatUnreadAction()).toEqual({ ok: false, error: "Something went wrong — try again." });
    expect(quiet).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
