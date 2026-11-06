import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_WINDOW_MS } from "@/lib/proposals.util";
import { createEvent, getEvent, getVisibleEvent } from "./events";
import { getCircleById } from "./circles";
import { closeDueProposals, createProposal, respondToProposal, withdrawLapsedEventProposals, withdrawProposal } from "./proposals";
import { addCircle, addMember, giveRole, join, proposalNotices, resetDb } from "./testing";

const NOW = new Date("2026-11-05T12:00:00-05:00");

beforeEach(async () => {
  // only the clock's date: the pg driver needs real timers
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("coop", { type: "cooperative", parentId: "city", name: "Coop" });
  await join("coop", 1, 2, 3);
  await addCircle("solo", { type: "cooperative", parentId: "city", name: "Solo" });
  await join("solo", 1);
});

afterEach(() => vi.useRealTimers());

describe("proposing a change to a circle", () => {
  it("opens it with the proposer's consent, for three days, and tells the others", async () => {
    const { proposal, circle } = await createProposal(1, "coop", { name: "Coop 2" });
    expect(circle).toBeNull();
    expect(proposal.status).toBe("open");
    expect(proposal.changes).toEqual({ name: "Coop 2" });
    expect(proposal.responses.map((r) => [r.memberId, r.response])).toEqual([[1, "like"]]);
    expect(new Date(proposal.closesAt).getTime() - NOW.getTime()).toBe(PROPOSAL_WINDOW_MS);
    expect(await proposalNotices(proposal.id, "opened")).toEqual([2, 3]);
    expect((await getCircleById("coop"))?.name).toBe("Coop");
  });

  it("refuses a non-member, an empty proposal, and a second while one is open", async () => {
    await expect(createProposal(4, "coop", { name: "Mine now" })).rejects.toThrow(/Only a circle's members/);
    await expect(createProposal(1, "coop", { name: "Coop" })).rejects.toThrow(/nothing would change/);
    await createProposal(1, "coop", { name: "Coop 2" });
    await expect(createProposal(2, "coop", { tagline: "Hello" })).rejects.toThrow(/already has a proposal open/);
  });

  it("decides at once in a circle of one, recording the proposer as editor", async () => {
    const { proposal, circle } = await createProposal(1, "solo", { name: "Solo 2" });
    expect(proposal.status).toBe("passed");
    expect(circle?.name).toBe("Solo 2");
    expect(circle?.lastEditedBy).toBe(1);
  });
});

describe("answering", () => {
  it("passes when every member has consented, like and accept alike", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    const first = await respondToProposal(2, proposal.id, "like");
    expect(first.proposal.status).toBe("open");
    expect(first.circle).toBeNull();
    const last = await respondToProposal(3, proposal.id, "accept");
    expect(last.proposal.status).toBe("passed");
    expect(last.circle?.name).toBe("Coop 2");
    // told, except the one whose answer passed it
    expect(await proposalNotices(proposal.id, "passed")).toEqual([1, 2]);
  });

  it("lets an answer be changed while it's open", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    await respondToProposal(2, proposal.id, "accept");
    const { proposal: after } = await respondToProposal(2, proposal.id, "like");
    expect(after.responses.filter((r) => r.memberId === 2).map((r) => r.response)).toEqual(["like"]);
  });

  it("closes on one objection, which needs a reason, and changes nothing", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    await expect(respondToProposal(2, proposal.id, "object")).rejects.toThrow(/Say why/);
    await expect(respondToProposal(2, proposal.id, "object", "   ")).rejects.toThrow(/Say why/);
    const { proposal: closed } = await respondToProposal(2, proposal.id, "object", "Too confusing");
    expect(closed.status).toBe("objected");
    expect((await getCircleById("coop"))?.name).toBe("Coop");
    expect(await proposalNotices(proposal.id, "objected")).toEqual([1, 3]);
    // it can be proposed again
    await expect(createProposal(1, "coop", { name: "Coop 3" })).resolves.toBeTruthy();
  });

  it("keeps it to the circle's members, and the proposer has nothing to answer", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    await expect(respondToProposal(4, proposal.id, "like")).rejects.toThrow(/doesn't exist/);
    await expect(respondToProposal(1, proposal.id, "like")).rejects.toThrow(/already consented/);
    await expect(respondToProposal(2, "nope", "like")).rejects.toThrow(/doesn't exist/);
  });

  it("refuses an answer once it's decided", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    await respondToProposal(2, proposal.id, "object", "No");
    await expect(respondToProposal(3, proposal.id, "like")).rejects.toThrow(/already been decided/);
  });

  it("refuses an answer after its window has closed, even before the poller passes it", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    vi.setSystemTime(new Date(NOW.getTime() + PROPOSAL_WINDOW_MS + 1000));
    await expect(respondToProposal(3, proposal.id, "like")).rejects.toThrow(/already been decided/);
  });
});

describe("the deadline", () => {
  it("passes an unobjected proposal when its window ends, and not before", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    expect(await closeDueProposals(new Date(NOW.getTime() + PROPOSAL_WINDOW_MS - 1000))).toEqual([]);
    expect((await getCircleById("coop"))?.name).toBe("Coop");
    expect(await closeDueProposals(new Date(NOW.getTime() + PROPOSAL_WINDOW_MS + 1000))).toEqual([proposal.id]);
    expect((await getCircleById("coop"))?.name).toBe("Coop 2");
    // nothing left to pass the second time
    expect(await closeDueProposals(new Date(NOW.getTime() + PROPOSAL_WINDOW_MS + 2000))).toEqual([]);
  });
});

describe("withdrawing a change", () => {
  it("is the proposer's alone, frees the circle and leaves it unchanged", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    await expect(withdrawProposal(2, proposal.id)).rejects.toThrow(/Only whoever proposed it/);
    await expect(withdrawProposal(4, proposal.id)).rejects.toThrow(/doesn't exist/);
    const withdrawn = await withdrawProposal(1, proposal.id);
    expect(withdrawn.status).toBe("withdrawn");
    expect((await getCircleById("coop"))?.name).toBe("Coop");
    await expect(createProposal(2, "coop", { tagline: "Hello" })).resolves.toBeTruthy();
  });

  it("drops the notices not yet sent", async () => {
    const { proposal } = await createProposal(1, "coop", { name: "Coop 2" });
    await withdrawProposal(1, proposal.id);
    expect(await proposalNotices(proposal.id, "opened")).toEqual([]);
  });
});

describe("a meeting proposed to its circle", () => {
  const meeting = {
    title: "Planning",
    kind: "meeting" as const,
    circleId: "coop",
    date: "2026-11-10",
    start: "18:00",
    end: "19:00",
    location: "Hall",
    description: "",
    agenda: [{ title: "Budget", category: "decide" as const }],
  };

  async function propose() {
    const { events, proposalId } = await createEvent(1, meeting);
    return { event: events[0]!, proposalId: proposalId! };
  }

  it("is saved unapproved, seen only by the circle, with the proposer going", async () => {
    const { event } = await propose();
    expect(event.proposed).toBe(true);
    expect(event.rsvps).toEqual([1]);
    expect(await getVisibleEvent(2, event.id)).not.toBeNull();
    expect(await getVisibleEvent(4, event.id)).toBeNull();
  });

  it("is scheduled when everyone consents, each consent being an RSVP", async () => {
    const { event, proposalId } = await propose();
    await respondToProposal(2, proposalId, "like");
    const { proposal } = await respondToProposal(3, proposalId, "accept");
    expect(proposal.status).toBe("passed");
    const after = await getEvent(event.id);
    expect(after?.proposed).toBeFalsy();
    expect([...after!.rsvps].sort()).toEqual([1, 2, 3]);
  });

  it("doesn't mark a member who stayed silent as going when the deadline passes it", async () => {
    const { event, proposalId } = await propose();
    await respondToProposal(2, proposalId, "like");
    expect(await closeDueProposals(new Date(NOW.getTime() + PROPOSAL_WINDOW_MS + 1000))).toEqual([proposalId]);
    const after = await getEvent(event.id);
    expect(after?.proposed).toBeFalsy();
    expect([...after!.rsvps].sort()).toEqual([1, 2]);
  });

  it("is discarded by an objection, the proposal keeping its record", async () => {
    const { event, proposalId } = await propose();
    const { proposal } = await respondToProposal(3, proposalId, "object", "Wrong night");
    expect(proposal.status).toBe("objected");
    expect(await getEvent(event.id)).toBeNull();
  });

  it("is withdrawn automatically once its start has come undecided, telling no one", async () => {
    const { event, proposalId } = await propose();
    const start = new Date("2026-11-10T18:30:00-05:00");
    expect(await withdrawLapsedEventProposals(new Date("2026-11-10T17:00:00-05:00"))).toEqual([]);
    expect(await withdrawLapsedEventProposals(start)).toEqual([proposalId]);
    expect(await getEvent(event.id)).toBeNull();
    expect(await closeDueProposals(new Date("2026-11-20T12:00:00-05:00"))).toEqual([]);
  });

  it("can't be withdrawn through withdrawProposal, which points at cancelling it", async () => {
    const { proposalId } = await propose();
    await expect(withdrawProposal(1, proposalId)).rejects.toThrow(/cancelling its event/);
  });

  it("is scheduled outright for a member holding a role in the circle, with no proposal", async () => {
    await giveRole("coop", "Secretary", 2);
    const { events, proposalId } = await createEvent(2, meeting);
    expect(proposalId).toBeUndefined();
    expect(events[0]?.proposed).toBeFalsy();
    expect(events[0]?.approvedByRole).toBe("Secretary");
    expect(await getVisibleEvent(3, events[0]!.id)).not.toBeNull();
  });
});
