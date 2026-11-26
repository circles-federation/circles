import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_WINDOW_MS } from "@/lib/proposals.util";
import { NOMINEE_WINDOW_MS, type NewFederationInput } from "@/lib/federation.util";
import { getCircleById, getCirclesForMember, leaveCircle } from "./circles";
import { createInvitation } from "./invitations";
import { claimProposalNotifications } from "./notifications";
import {
  closeDueProposals,
  createProposal,
  getProposalsForMember,
  nominateFederationDelegate,
  objectToFederationDelegate,
  proposeFederation,
  respondToProposal,
  withdrawProposal,
} from "./proposals";
import { addCircle, addMember, archiveCircle, circleArchived, join, leave, moveCircle, proposalNotices, resetDb, roleHolder, seatIn, setRoles } from "./testing";

const NOW = new Date("2026-11-05T12:00:00-05:00");
const later = (ms: number) => vi.setSystemTime(new Date(NOW.getTime() + ms));

beforeEach(async () => {
  // only the clock's date: the pg driver needs real timers
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await resetDb();
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city", name: "The 903" });
  await addCircle("bikes", { type: "cooperative", parentId: "the903", name: "Bikes" });
  await join("bikes", 1, 2);
  await addCircle("grocery", { type: "cooperative", parentId: "the903", name: "Grocery" });
  await join("grocery", 3, 4);
  await addCircle("tools", { type: "collective", parentId: "city", name: "Tools" });
  await join("tools", 5);
  await addCircle("council", { type: "circle", parentId: "the903", name: "Council" });
  await join("council", 6);
});

afterEach(() => vi.useRealTimers());

const input = (over: Partial<NewFederationInput> = {}): NewFederationInput => ({
  name: "Co-op Alliance",
  tagline: "",
  parentId: "city",
  circleId: "bikes",
  delegateId: 2,
  joinIds: ["grocery"],
  ...over,
});

const seenBy = async (memberId: number) => (await getProposalsForMember(memberId)).map((p) => p.id);

// proposed by 1, and the first circle's other member consents, which releases the second circle
async function released(over: Partial<NewFederationInput> = {}) {
  const { id } = await proposeFederation(1, input(over));
  await respondToProposal(2, id, "like");
  return id;
}

describe("proposing a federation", () => {
  it("opens it for the proposer's circle alone, and tells only them", async () => {
    const p = await proposeFederation(1, input());
    expect(p.kind).toBe("coordinating_circle");
    expect(p.status).toBe("open");
    expect(p.circleId).toBe("bikes");
    expect(p.changes).toEqual({ type: "federation", name: "Co-op Alliance", tagline: "", parentId: "city" });
    expect(p.responses.map((r) => [r.memberId, r.response])).toEqual([[1, "like"]]);
    expect(new Date(p.closesAt).getTime() - NOW.getTime()).toBe(PROPOSAL_WINDOW_MS);
    expect(p.lines.map((l) => l.label)).toContain("Circles");
    expect(await proposalNotices(p.id, "opened")).toEqual([2]);
    expect(p.deciders?.map((d) => [d.circleId, d.stage, !!d.releasedAt])).toEqual([["bikes", 1, true], ["grocery", 2, false]]);
    expect(p.deciders?.[0]?.nominees.map((n) => [n.memberId, n.status])).toEqual([[2, "open"]]);
  });

  it("keeps it from the other circles until the first has consented", async () => {
    const p = await proposeFederation(1, input());
    expect(await seenBy(1)).toEqual([p.id]);
    expect(await seenBy(2)).toEqual([p.id]);
    expect(await seenBy(3)).toEqual([]);
    expect(await seenBy(4)).toEqual([]);
    await expect(respondToProposal(3, p.id, "like")).rejects.toThrow(/doesn't exist/);
    await expect(respondToProposal(3, p.id, "object", "No")).rejects.toThrow(/doesn't exist/);
  });

  it("refuses what the form would, and a circle already in a proposed federation", async () => {
    await expect(proposeFederation(3, input())).rejects.toThrow(/a circle you're in/);
    await expect(proposeFederation(1, input({ joinIds: [] }))).rejects.toThrow(/at least one other/);
    await expect(proposeFederation(1, input({ joinIds: ["council"] }))).rejects.toThrow(/only collectives and co-ops/);
    await expect(proposeFederation(1, input({ delegateId: 3 }))).rejects.toThrow(/member of Bikes/);
    await expect(proposeFederation(1, input({ parentId: "council" }))).rejects.toThrow(/where the federation sits/);
    await proposeFederation(1, input());
    await expect(proposeFederation(5, input({ circleId: "tools", delegateId: 5, joinIds: ["grocery"] }))).rejects.toThrow(/already part of a proposed federation/);
  });

  it("releases the others at once when its own circle is just the proposer", async () => {
    await addCircle("solo", { type: "cooperative", parentId: "city", name: "Solo" });
    await join("solo", 7);
    const p = await proposeFederation(7, input({ circleId: "solo", delegateId: 7, joinIds: ["grocery"] }));
    expect(p.deciders?.map((d) => !!d.passedAt)).toEqual([true, false]);
    expect(p.deciders?.[1]?.releasedAt).toBeDefined();
    expect(await seenBy(3)).toEqual([p.id]);
    expect(await proposalNotices(p.id, "opened")).toEqual([3, 4]);
  });
});

describe("the first circle", () => {
  it("releases the rest when all its members consent, and asks them for three days", async () => {
    const { id } = await proposeFederation(1, input());
    later(60 * 60 * 1000);
    const { proposal } = await respondToProposal(2, id, "accept");
    expect(proposal.status).toBe("open");
    expect(proposal.deciders?.[0]?.passedAt).toBeDefined();
    expect(proposal.deciders?.[0]?.nominees.map((n) => n.status)).toEqual(["chosen"]);
    expect(proposal.deciders?.[1]?.releasedAt).toBeDefined();
    expect(new Date(proposal.closesAt).getTime() - Date.now()).toBe(PROPOSAL_WINDOW_MS);
    expect(await seenBy(3)).toEqual([id]);
    expect(await proposalNotices(id, "opened")).toEqual([2, 3, 4]);
  });

  it("ends it, for everyone told so far, when a member objects", async () => {
    const { id } = await proposeFederation(1, input());
    const { proposal } = await respondToProposal(2, id, "object", "Not yet");
    expect(proposal.status).toBe("objected");
    expect(await proposalNotices(id, "objected")).toEqual([1]);
    expect(await seenBy(3)).toEqual([]);
    expect((await getCircleById("bikes"))?.parentId).toBe("the903");
  });

  it("passes at its deadline with no objection, silence being consent", async () => {
    const { id } = await proposeFederation(1, input());
    later(PROPOSAL_WINDOW_MS + 1000);
    expect(await closeDueProposals()).toEqual([]);
    const p = (await getProposalsForMember(3)).find((x) => x.id === id);
    expect(p?.status).toBe("open");
    expect(p?.deciders?.[1]?.releasedAt).toBeDefined();
    expect(new Date(p!.closesAt).getTime() - Date.now()).toBe(PROPOSAL_WINDOW_MS);
  });
});

describe("the other circles", () => {
  it("need a delegate before they pass, and each member's consent to that delegate", async () => {
    const id = await released();
    const named = await nominateFederationDelegate(3, id, "grocery", 4);
    expect(named.deciders?.[1]?.nominees.map((n) => [n.memberId, n.nominatedBy, n.status])).toEqual([[4, 3, "open"]]);
    // 3 consenting before the delegate was named doesn't count for them
    const first = await respondToProposal(3, id, "like");
    expect(first.proposal.status).toBe("open");
    const last = await respondToProposal(4, id, "accept");
    expect(last.proposal.status).toBe("passed");
  });

  it("form the federation where the proposer chose, with each circle's delegate its only members", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 3);
    await respondToProposal(3, id, "like");
    const { proposal } = await respondToProposal(4, id, "like");
    expect(proposal.status).toBe("passed");
    const fedId = proposal.subjectCircleId!;
    const fed = await getCircleById(fedId);
    expect(fed?.type).toBe("federation");
    expect(fed?.name).toBe("Co-op Alliance");
    expect(fed?.parentId).toBe("city");
    expect([...fed!.members].sort()).toEqual([2, 3]);
    expect((await getCircleById("bikes"))?.parentId).toBe(fedId);
    expect((await getCircleById("grocery"))?.parentId).toBe(fedId);
    expect(await seatIn(fedId, 2)).toBe("bikes");
    expect(await seatIn(fedId, 3)).toBe("grocery");
    expect(await roleHolder("bikes", "Delegate")).toBe(2);
    expect(await roleHolder("grocery", "Delegate")).toBe(3);
    expect(await proposalNotices(id, "passed")).toEqual([1, 2, 3]);
  });

  it("can be placed in a neighborhood", async () => {
    const id = await released({ parentId: "the903" });
    await nominateFederationDelegate(3, id, "grocery", 3);
    await respondToProposal(3, id, "like");
    const { proposal } = await respondToProposal(4, id, "like");
    expect((await getCircleById(proposal.subjectCircleId!))?.parentId).toBe("the903");
  });

  it("can join from across the city, whatever neighborhood they were in", async () => {
    const id = await released({ joinIds: ["grocery", "tools"] });
    await nominateFederationDelegate(3, id, "grocery", 3);
    await nominateFederationDelegate(5, id, "tools", 5);
    await respondToProposal(3, id, "like");
    await respondToProposal(4, id, "like");
    const { proposal } = await respondToProposal(5, id, "like");
    expect(proposal.status).toBe("passed");
    const fedId = proposal.subjectCircleId!;
    for (const c of ["bikes", "grocery", "tools"]) expect((await getCircleById(c))?.parentId).toBe(fedId);
    expect([...(await getCircleById(fedId))!.members].sort()).toEqual([2, 3, 5]);
  });

  it("see it only once released, with the rest of the answers", async () => {
    const id = await released();
    const p = (await getProposalsForMember(4)).find((x) => x.id === id);
    expect(p?.deciders?.map((d) => d.circleId)).toEqual(["bikes", "grocery"]);
    expect(await seenBy(5)).toEqual([]);
  });

  it("end it with an objection to the federation itself, telling everyone who has seen it", async () => {
    const id = await released();
    const { proposal } = await respondToProposal(4, id, "object", "We're not ready");
    expect(proposal.status).toBe("objected");
    expect(await proposalNotices(id, "objected")).toEqual([1, 2, 3]);
    expect((await getCircleById("grocery"))?.parentId).toBe("the903");
  });

  it("only drop a delegate who's objected to, leaving the proposal open for another", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 4);
    later(60 * 60 * 1000);
    const p = await objectToFederationDelegate(3, id, "grocery", "I'd rather do it");
    expect(p.status).toBe("open");
    expect(p.deciders?.[1]?.nominees.map((n) => [n.memberId, n.status, n.objectedBy, n.objectionReason])).toEqual([[4, "objected", 3, "I'd rather do it"]]);
    await nominateFederationDelegate(3, id, "grocery", 3);
    const again = (await getProposalsForMember(3)).find((x) => x.id === id);
    expect(again?.deciders?.[1]?.nominees.map((n) => n.status)).toEqual(["objected", "open"]);
  });

  it("have time to answer a delegate named late in their window", async () => {
    const id = await released();
    later(PROPOSAL_WINDOW_MS - 60 * 1000);
    const p = await nominateFederationDelegate(3, id, "grocery", 3);
    expect(new Date(p.closesAt).getTime() - Date.now()).toBe(NOMINEE_WINDOW_MS);
    expect(p.deciders?.[1]?.closesAt).toBe(p.closesAt);
  });

  it("pass at their deadline with a delegate and no objection", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 3);
    later(PROPOSAL_WINDOW_MS + 1000);
    expect(await closeDueProposals()).toEqual([id]);
    const fed = (await getCirclesForMember(1)).find((c) => c.type === "federation");
    expect(fed?.parentId).toBe("city");
    expect([...fed!.members].sort()).toEqual([2, 3]);
  });

  it("lapse at their deadline if a circle never put anyone forward", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 3);
    await objectToFederationDelegate(4, id, "grocery", "No");
    later(PROPOSAL_WINDOW_MS + NOMINEE_WINDOW_MS + 1000);
    expect(await closeDueProposals()).toEqual([]);
    const p = (await getProposalsForMember(1)).find((x) => x.id === id);
    expect(p?.status).toBe("withdrawn");
    expect(p?.lapsed).toBe(true);
    expect((await getCircleById("grocery"))?.parentId).toBe("the903");
    expect((await getCirclesForMember(1)).some((c) => c.type === "federation")).toBe(false);
  });
});

describe("delegates", () => {
  it("must be members of their own circle, put forward by a member, one at a time", async () => {
    const id = await released();
    await expect(nominateFederationDelegate(3, id, "grocery", 1)).rejects.toThrow(/one of its members/);
    await expect(nominateFederationDelegate(1, id, "grocery", 3)).rejects.toThrow(/doesn't exist/);
    await expect(nominateFederationDelegate(5, id, "grocery", 3)).rejects.toThrow(/doesn't exist/);
    await nominateFederationDelegate(3, id, "grocery", 3);
    await expect(nominateFederationDelegate(4, id, "grocery", 4)).rejects.toThrow(/already been put forward/);
  });

  it("are the first circle's to settle in the proposal, and the others' to object to only once released", async () => {
    const p = await proposeFederation(1, input());
    await expect(nominateFederationDelegate(3, p.id, "grocery", 3)).rejects.toThrow(/doesn't exist/);
    await expect(objectToFederationDelegate(2, p.id, "bikes", "Not them")).rejects.toThrow(/part of the proposal itself/);
    await respondToProposal(2, p.id, "like");
    await expect(objectToFederationDelegate(3, p.id, "grocery", "Not them")).rejects.toThrow(/No one is waiting/);
    await nominateFederationDelegate(3, p.id, "grocery", 3);
    await expect(objectToFederationDelegate(3, p.id, "grocery", "  ")).rejects.toThrow(/Say why/);
  });

  it("keep their Delegate role in the federation when a circle's roles change", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 3);
    await respondToProposal(3, id, "like");
    const { proposal } = await respondToProposal(4, id, "like");
    const fedId = proposal.subjectCircleId!;
    await setRoles("grocery", [{ label: "Delegate", memberId: 4 }, { label: "Secretary", memberId: 3 }]);
    expect(await roleHolder("grocery", "Delegate")).toBe(4);
    expect(await seatIn(fedId, 4)).toBe("grocery");
    expect(await seatIn(fedId, 3)).toBeUndefined();
  });
});

describe("a federation that can't go ahead", () => {
  it("lapses when a circle is archived before it's released, telling those asked so far", async () => {
    const { id } = await proposeFederation(1, input());
    await archiveCircle("grocery");
    await respondToProposal(2, id, "like");
    const p = (await getProposalsForMember(1)).find((x) => x.id === id);
    expect(p?.status).toBe("withdrawn");
    expect(p?.lapsed).toBe(true);
    expect(await seenBy(3)).toEqual([]);
    // no one is asked to answer what's closed, so its unsent notices go
    expect(await proposalNotices(id, "opened")).toEqual([]);
    // but whoever's answer ended it, who sees it there and then
    expect(await proposalNotices(id, "lapsed")).toEqual([1]);
  });

  it("tells every circle asked when it lapses at its deadline, in their own circle's name", async () => {
    const id = await released();
    later(PROPOSAL_WINDOW_MS + 1000);
    await closeDueProposals(new Date());
    expect(await proposalNotices(id, "lapsed")).toEqual([1, 2, 3, 4]);
    const claimed = await claimProposalNotifications(50, "email");
    expect(claimed.find((n) => n.notice === "lapsed" && n.memberId === 3)).toMatchObject({ circleName: "Grocery" });
  });

  it("lapses when a circle has joined another federation by the time it would pass", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 3);
    await respondToProposal(3, id, "like");
    await addCircle("other", { type: "federation", parentId: "city", name: "Other" });
    await join("other", 8);
    await moveCircle("grocery", "other");
    const { proposal } = await respondToProposal(4, id, "like");
    expect(proposal.status).toBe("withdrawn");
    expect(proposal.lapsed).toBe(true);
    expect((await getCircleById("bikes"))?.parentId).toBe("the903");
  });

  it("lapses when a delegate has left their circle", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 3);
    await respondToProposal(3, id, "like");
    await leave("grocery", 3);
    const { proposal } = await respondToProposal(4, id, "like");
    expect(proposal.lapsed).toBe(true);
  });
});

describe("withdrawing", () => {
  it("is the proposer's alone, and drops the notices not yet sent", async () => {
    const { id } = await proposeFederation(1, input());
    await expect(withdrawProposal(2, id)).rejects.toThrow(/Only whoever proposed/);
    const p = await withdrawProposal(1, id);
    expect(p.status).toBe("withdrawn");
    expect(await proposalNotices(id, "opened")).toEqual([]);
  });

  it("works after the others have been released too", async () => {
    const id = await released();
    expect((await withdrawProposal(1, id)).status).toBe("withdrawn");
    await expect(respondToProposal(3, id, "like")).rejects.toThrow(/already been decided/);
    await expect(nominateFederationDelegate(3, id, "grocery", 3)).rejects.toThrow(/already been decided/);
    expect((await getCircleById("bikes"))?.parentId).toBe("the903");
  });

  it("frees the circles to be proposed again", async () => {
    const { id } = await proposeFederation(1, input());
    await withdrawProposal(1, id);
    await expect(proposeFederation(1, input())).resolves.toMatchObject({ status: "open" });
  });
});

// the Alliance of Bikes (delegate 2) and Grocery (delegate 3), formed and under the city
async function formed(over: Partial<NewFederationInput> = {}): Promise<string> {
  const id = await released(over);
  await nominateFederationDelegate(3, id, "grocery", 3);
  await respondToProposal(3, id, "like");
  const { proposal } = await respondToProposal(4, id, "like");
  return proposal.subjectCircleId!;
}

describe("inside a federation", () => {
  it("shows each circle's Delegate to everyone, and the federation none of its own", async () => {
    const fedId = await formed();
    const delegate = (c: { roles?: { label: string; builtin: boolean; memberId: number | null }[] } | null | undefined) => c?.roles?.find((r) => r.label === "Delegate");
    expect(delegate(await getCircleById("grocery"))).toEqual({ label: "Delegate", builtin: true, memberId: 3 });
    const all = await getCirclesForMember(8);
    expect(delegate(all.find((c) => c.id === "bikes"))?.memberId).toBe(2);
    expect(delegate(all.find((c) => c.id === fedId))).toBeUndefined();
    // a circle not in one still has none, whatever its type
    expect(delegate(all.find((c) => c.id === "tools"))).toBeUndefined();
  });

  it("doesn't take invitations, its members being its circles' delegates", async () => {
    const fedId = await formed();
    await expect(createInvitation(2, fedId, 8)).rejects.toThrow(/delegates, so it doesn't take invitations/);
  });

  it("keeps a circle's delegate from leaving until its members choose another", async () => {
    await formed();
    await expect(leaveCircle(3, "grocery")).rejects.toThrow(/Choose another delegate before you leave/);
    expect(await seatIn("grocery", 3)).toBeNull();
    // anyone else can
    await leaveCircle(4, "grocery");
    expect(await roleHolder("grocery", "Delegate")).toBe(3);
  });

  it("lets a delegate leave a circle once they're its only member, which archives it and sends no one up", async () => {
    const fedId = await formed();
    await leaveCircle(4, "grocery");
    await leaveCircle(3, "grocery");
    expect(await circleArchived("grocery")).toBe(true);
    expect(await seatIn(fedId, 3)).toBeUndefined();
    expect(await seatIn(fedId, 2)).toBe("bikes");
  });

  it("changes its delegate by consent, moving their seat in the federation", async () => {
    const fedId = await formed();
    const roles = [{ label: "Delegate", memberId: 4 }];
    const { proposal } = await createProposal(3, "grocery", { roles });
    expect(proposal.lines.map((l) => [l.label, l.after])).toEqual([["Delegate", "Member 4"]]);
    await respondToProposal(4, proposal.id, "like");
    expect(await roleHolder("grocery", "Delegate")).toBe(4);
    expect(await seatIn(fedId, 4)).toBe("grocery");
    expect(await seatIn(fedId, 3)).toBeUndefined();
    // the old delegate can now leave
    await leaveCircle(3, "grocery");
  });

  it("can't propose leaving it without a delegate, or changing what it is or where it sits", async () => {
    await formed();
    await expect(createProposal(3, "grocery", { roles: [{ label: "Delegate", memberId: null }] })).rejects.toThrow(/Choose a delegate/);
    await expect(createProposal(3, "grocery", { roles: [{ label: "Secretary", memberId: 3 }] })).rejects.toThrow(/Choose a delegate/);
    await expect(createProposal(3, "grocery", { parentId: "the903" })).rejects.toThrow(/stays there/);
    await expect(createProposal(3, "grocery", { type: "collective" })).rejects.toThrow(/stays the kind of circle/);
    // renaming and other roles are fine
    await expect(createProposal(3, "grocery", { name: "Grocery Co-op" })).resolves.toMatchObject({ proposal: { status: "open" } });
  });

  it("can't be turned into another kind of circle, itself", async () => {
    const fedId = await formed();
    await expect(createProposal(2, fedId, { type: "circle" })).rejects.toThrow(/can't become another kind of circle/);
  });
});

describe("telling a circle about its delegate", () => {
  it("tells its other members when one is put forward, in their own circle's name", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 4);
    expect(await proposalNotices(id, "nominated")).toEqual([4]);
    const claimed = await claimProposalNotifications(50, "email");
    const notice = claimed.find((n) => n.notice === "nominated");
    expect(notice).toMatchObject({ memberId: 4, circleName: "Grocery", nomineeName: "Member 4" });
    expect(claimed.find((n) => n.notice === "opened" && n.memberId === 3)).toMatchObject({ circleName: "Grocery" });
  });

  it("tells them who objected and why, in place of the nomination, and again for the next", async () => {
    const id = await released();
    await nominateFederationDelegate(3, id, "grocery", 4);
    await objectToFederationDelegate(4, id, "grocery", "Too busy");
    expect(await proposalNotices(id, "nominated")).toEqual([]);
    expect(await proposalNotices(id, "nominee_objected")).toEqual([3]);
    const claimed = await claimProposalNotifications(50, "email");
    expect(claimed.find((n) => n.notice === "nominee_objected")).toMatchObject({ circleName: "Grocery", nomineeName: "Member 4", objectorName: "Member 4", reason: "Too busy" });
    await nominateFederationDelegate(4, id, "grocery", 3);
    expect(await proposalNotices(id, "nominated")).toEqual([3]);
    expect(await proposalNotices(id, "nominee_objected")).toEqual([]);
  });
});

describe("once a circle has consented", () => {
  it("takes no more answers from its members", async () => {
    const id = await released();
    await expect(respondToProposal(2, id, "object", "Changed my mind")).rejects.toThrow(/already consented/);
  });
});
