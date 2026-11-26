import { describe, expect, it } from "vitest";
import { indexCircles } from "./circles.util";
import {
  checkNewFederation,
  circleIsInFederation,
  defaultFederationParent,
  describeNewFederation,
  federationDeciders,
  federationRefusal,
  federationStep,
  type FederationState,
  validateNewFederation,
  type NewFederationInput,
} from "./federation.util";
import { circle } from "./test/factories";

const circles = [
  circle({ id: "city", type: "other", parentId: null, name: "Providence", members: [1, 2, 3, 4] }),
  circle({ id: "the903", type: "neighborhood", parentId: "city", name: "The 903" }),
  circle({ id: "fox", type: "neighborhood", parentId: "city", name: "Fox Point" }),
  circle({ id: "bikes", type: "cooperative", parentId: "the903", name: "Bike Co-op", members: [1, 2] }),
  circle({ id: "grocery", type: "cooperative", parentId: "the903", name: "Grocery Co-op", members: [3] }),
  circle({ id: "tools", type: "collective", parentId: "fox", name: "Tool Library", members: [4] }),
  circle({ id: "bakery", type: "cooperative", parentId: "city", name: "Bakery", members: [2] }),
  circle({ id: "council", type: "circle", parentId: "the903", name: "Council", members: [1] }),
  circle({ id: "alliance", type: "federation", parentId: "city", name: "Alliance" }),
  circle({ id: "joined", type: "cooperative", parentId: "alliance", name: "Joined Co-op", members: [1] }),
];
const byId = indexCircles(circles);

const input = (over: Partial<NewFederationInput> = {}): NewFederationInput => ({
  name: "Co-op Alliance",
  tagline: "",
  parentId: "city",
  circleId: "bikes",
  delegateId: 1,
  joinIds: ["grocery"],
  ...over,
});

describe("federationRefusal", () => {
  it("lets a collective or co-op anywhere join", () => {
    expect(federationRefusal(byId.bikes!, byId)).toBeNull();
    expect(federationRefusal(byId.tools!, byId)).toBeNull();
    expect(federationRefusal(byId.bakery!, byId)).toBeNull();
  });
  it("refuses every other kind, the city and a circle already in a federation", () => {
    expect(federationRefusal(byId.council!, byId)).toMatch(/collectives and co-ops/);
    expect(federationRefusal(byId.the903!, byId)).toMatch(/collectives and co-ops/);
    expect(federationRefusal(byId.alliance!, byId)).toMatch(/collectives and co-ops/);
    expect(federationRefusal(byId.city!, byId)).toBe("The whole city");
    expect(federationRefusal(byId.joined!, byId)).toBe("Already in a federation");
  });
});

describe("circleIsInFederation", () => {
  it("is true only directly inside a federation", () => {
    expect(circleIsInFederation(byId.joined!, byId)).toBe(true);
    expect(circleIsInFederation(byId.bikes!, byId)).toBe(false);
    expect(circleIsInFederation(byId.city!, byId)).toBe(false);
  });
});

describe("defaultFederationParent", () => {
  it("is the neighborhood they all share", () => {
    expect(defaultFederationParent(["bikes", "grocery"], byId)?.id).toBe("the903");
  });
  it("is the city when they differ or already sit there", () => {
    expect(defaultFederationParent(["bikes", "tools"], byId)?.id).toBe("city");
    expect(defaultFederationParent(["bikes", "bakery"], byId)?.id).toBe("city");
    expect(defaultFederationParent(["bakery"], byId)?.id).toBe("city");
  });
});

describe("checkNewFederation", () => {
  it("accepts two co-ops in one neighborhood, placed anywhere", () => {
    expect(checkNewFederation(input(), 1, circles)).toBeNull();
    expect(checkNewFederation(input({ parentId: "the903" }), 1, circles)).toBeNull();
    expect(checkNewFederation(input({ parentId: "fox", joinIds: ["grocery", "tools"] }), 1, circles)).toBeNull();
  });
  it("needs a name of a sensible length and a short tagline", () => {
    expect(checkNewFederation(input({ name: "  " }), 1, circles)?.field).toBe("name");
    expect(checkNewFederation(input({ name: "x".repeat(81) }), 1, circles)?.field).toBe("name");
    expect(checkNewFederation(input({ tagline: "x".repeat(141) }), 1, circles)?.field).toBe("tagline");
  });
  it("must be proposed from a circle the proposer is in", () => {
    expect(checkNewFederation(input(), 3, circles)?.field).toBe("circleIds");
    expect(checkNewFederation(input({ circleId: "nope" }), 1, circles)?.field).toBe("circleIds");
  });
  it("needs at least one other circle, each once", () => {
    expect(checkNewFederation(input({ joinIds: [] }), 1, circles)?.message).toMatch(/at least one other/);
    expect(checkNewFederation(input({ joinIds: ["grocery", "grocery"] }), 1, circles)?.message).toMatch(/only once/);
    expect(checkNewFederation(input({ joinIds: ["bikes"] }), 1, circles)?.message).toMatch(/only once/);
  });
  it("caps how many circles join", () => {
    const many = Array.from({ length: 20 }, (_, i) => `c${i}`);
    expect(checkNewFederation(input({ joinIds: many }), 1, circles)?.message).toMatch(/20 circles or fewer/);
  });
  it("names a circle that can't join and why", () => {
    expect(checkNewFederation(input({ joinIds: ["council"] }), 1, circles)?.message).toBe("Council: only collectives and co-ops.");
    expect(checkNewFederation(input({ joinIds: ["joined"] }), 1, circles)?.message).toBe("Joined Co-op: already in a federation.");
    expect(checkNewFederation(input({ joinIds: ["nope"] }), 1, circles)?.field).toBe("circleIds");
  });
  it("needs a delegate from the proposer's own circle", () => {
    expect(checkNewFederation(input({ delegateId: undefined }), 1, circles)?.field).toBe("delegateId");
    expect(checkNewFederation(input({ delegateId: 3 }), 1, circles)?.field).toBe("delegateId");
  });
  it("only sits in a neighborhood or the city", () => {
    expect(checkNewFederation(input({ parentId: "council" }), 1, circles)?.field).toBe("parentId");
    expect(checkNewFederation(input({ parentId: "bikes" }), 1, circles)?.field).toBe("parentId");
    expect(checkNewFederation(input({ parentId: "alliance" }), 1, circles)?.field).toBe("parentId");
  });
  it("says just the message for the server", () => {
    expect(validateNewFederation(input(), 1, circles)).toBeNull();
    expect(validateNewFederation(input({ name: "" }), 1, circles)).toBe("Give the federation a name.");
  });
});

describe("federationDeciders", () => {
  it("has the proposer's circle decide first and the rest second", () => {
    expect(federationDeciders(input({ joinIds: ["grocery", "tools"] }))).toEqual([
      { circleId: "bikes", stage: 1 },
      { circleId: "grocery", stage: 2 },
      { circleId: "tools", stage: 2 },
    ]);
  });
});

describe("describeNewFederation", () => {
  it("reads as the proposal does to the circles asked", () => {
    const lines = describeNewFederation({ name: " Alliance ", tagline: "" }, { parent: "Providence", circles: ["Bikes", "Grocery"], ownCircle: "Bikes", delegate: "Ona" });
    expect(lines.map((l) => [l.label, l.after])).toEqual([
      ["Name", "Alliance"],
      ["Type", "Federation"],
      ["Where", "Providence"],
      ["Circles", "Bikes; Grocery"],
      ["Bikes's delegate", "Ona"],
    ]);
  });
});

describe("federationStep", () => {
  const at = (n: number) => new Date(2026, 10, 5, 12, n);
  const state = (over: Partial<FederationState> = {}): FederationState => ({
    proposerId: 1,
    deciders: [
      { circleId: "a", stage: 1, memberIds: [1, 2], passed: false, nominee: { status: "open", createdAt: at(0) } },
      { circleId: "b", stage: 2, memberIds: [3, 4], passed: false },
    ],
    responses: [],
    ...over,
  });

  it("waits on the first circle until all its members have consented", () => {
    expect(federationStep(state(), false)).toEqual({ passed: [], release: false, lapse: null, done: false });
  });
  it("passes the first circle and releases the rest once its members have consented", () => {
    const s = state({ responses: [{ memberId: 2, response: "accept", respondedAt: at(5) }] });
    expect(federationStep(s, false)).toEqual({ passed: ["a"], release: true, lapse: null, done: false });
  });
  it("passes the first circle at its deadline, silence being consent", () => {
    expect(federationStep(state(), true)).toEqual({ passed: ["a"], release: true, lapse: null, done: false });
  });
  it("doesn't count an objection as consent", () => {
    const s = state({ responses: [{ memberId: 2, response: "object", respondedAt: at(5) }] });
    expect(federationStep(s, false).release).toBe(false);
  });

  const second = (over: Partial<FederationState["deciders"][number]> = {}, responses: FederationState["responses"] = []): FederationState =>
    state({
      deciders: [
        { circleId: "a", stage: 1, memberIds: [1, 2], passed: true },
        { circleId: "b", stage: 2, memberIds: [3, 4], passed: false, nominee: { status: "open", createdAt: at(10) }, ...over },
      ],
      responses,
    });

  it("passes a released circle early once every member has consented since its delegate was named", () => {
    const all: FederationState["responses"] = [
      { memberId: 3, response: "like", respondedAt: at(11) },
      { memberId: 4, response: "accept", respondedAt: at(12) },
    ];
    expect(federationStep(second({}, all), false)).toEqual({ passed: ["b"], release: false, lapse: null, done: true });
  });
  it("makes members consent again to a delegate named after they answered", () => {
    const early: FederationState["responses"] = [
      { memberId: 3, response: "like", respondedAt: at(5) },
      { memberId: 4, response: "like", respondedAt: at(12) },
    ];
    expect(federationStep(second({}, early), false)).toEqual({ passed: [], release: false, lapse: null, done: false });
  });
  it("takes the proposer's consent as given in a circle they're also in", () => {
    const s = second({ memberIds: [1, 4] }, [{ memberId: 4, response: "like", respondedAt: at(12) }]);
    expect(federationStep(s, false).done).toBe(true);
  });
  it("passes a circle with a delegate at the deadline, silence being consent", () => {
    expect(federationStep(second(), true)).toEqual({ passed: ["b"], release: false, lapse: null, done: true });
  });
  it("lapses at the deadline when a circle has no delegate, or its delegate was objected to", () => {
    expect(federationStep(second({ nominee: undefined }), true)).toEqual({ passed: [], release: false, lapse: "b", done: false });
    expect(federationStep(second({ nominee: { status: "objected", createdAt: at(10) } }), true).lapse).toBe("b");
  });
  it("waits, rather than lapsing, before the deadline", () => {
    expect(federationStep(second({ nominee: undefined }), false)).toEqual({ passed: [], release: false, lapse: null, done: false });
  });
  it("is done only when every released circle has passed", () => {
    const s: FederationState = {
      proposerId: 1,
      deciders: [
        { circleId: "a", stage: 1, memberIds: [1], passed: true },
        { circleId: "b", stage: 2, memberIds: [3], passed: true },
        { circleId: "c", stage: 2, memberIds: [4], passed: false, nominee: { status: "open", createdAt: at(10) } },
      ],
      responses: [],
    };
    expect(federationStep(s, false).done).toBe(false);
    expect(federationStep(s, true)).toEqual({ passed: ["c"], release: false, lapse: null, done: true });
  });
});
