import { describe, expect, it } from "vitest";
import {
  awaitingResponse,
  changedFields,
  checkChanges,
  checkCircleBasics,
  describeChanges,
  describeChatRemoval,
  describeEventProposal,
  describeNewCircle,
  describePostProposal,
  everyoneConsented,
  hasChanges,
  neighborhoodConsentFor,
  newCircleDecider,
  newCircleNeighborhood,
  openProposalsFor,
  proposalTitle,
  responseOf,
  validateChanges,
} from "./proposals.util";
import { indexCircles } from "./circles.util";
import { circle, proposal, tree } from "./test/factories";
import type { Circle, GroupFeature, ProposalResponse } from "./types";

const answer = (memberId: number, response: ProposalResponse["response"]): ProposalResponse => ({ memberId, response, respondedAt: "2026-11-01T13:00:00.000Z" });

// a defined Circle in the neighborhood, with its built-in roles
const defined = (over: Partial<Circle> = {}) =>
  circle({
    id: "c",
    parentId: "the903",
    name: "Garden",
    tagline: "Grow things",
    members: [1, 2],
    domain: "The community garden",
    aims: ["Grow food"],
    roles: [
      { label: "Secretary", builtin: true, memberId: null },
      { label: "Leader", builtin: true, memberId: 1 },
      { label: "Facilitator", builtin: true, memberId: null },
      { label: "Delegate", builtin: true, memberId: null },
    ],
    ...over,
  });

const world = (c: Circle) => {
  const t = tree();
  return [t.city, t.the903, t.coop, t.club, c];
};

describe("changedFields", () => {
  const c = defined();
  it("is empty when nothing changes", () => {
    const out = changedFields(c, { name: "Garden", tagline: "Grow things", type: "circle", parentId: "the903", domain: "The community garden", aims: ["Grow food"], inbox: false });
    expect(out).toEqual({});
    expect(hasChanges(out)).toBe(false);
  });
  it("trims names and keeps only what differs", () => {
    expect(changedFields(c, { name: "  Allotment ", tagline: "Grow things" })).toEqual({ name: "Allotment" });
  });
  it("drops blank aims before comparing", () => {
    expect(changedFields(c, { aims: [" Grow food ", " ", ""] })).toEqual({});
    expect(changedFields(c, { aims: ["Grow food", "Share it"] })).toEqual({ aims: ["Grow food", "Share it"] });
  });
  it("treats a missing domain as empty", () => {
    expect(changedFields(defined({ domain: undefined }), { domain: " " })).toEqual({});
  });
  it("compares the Inbox as a boolean", () => {
    expect(changedFields(defined({ inbox: undefined }), { inbox: false })).toEqual({});
    expect(changedFields(c, { inbox: true })).toEqual({ inbox: true });
  });
  it("drops a role with no name and ignores an unchanged list", () => {
    const same = c.roles!.map((r) => ({ label: r.label, memberId: r.memberId }));
    expect(changedFields(c, { roles: [...same, { label: "  ", memberId: null }] })).toEqual({});
    const moved = same.map((r) => (r.label === "Secretary" ? { ...r, memberId: 2 } : r));
    expect(changedFields(c, { roles: moved })).toEqual({ roles: moved });
  });
});

describe("checkChanges", () => {
  const c = defined();
  const circles = world(c);
  const check = (changes: Parameters<typeof checkChanges>[1], target = c) => checkChanges(target, changes, world(target));

  it("accepts valid changes, and none", () => {
    expect(check({})).toBeNull();
    expect(check({ name: "Allotment", tagline: "x" })).toBeNull();
    expect(validateChanges(c, { name: "Allotment" }, circles)).toBeNull();
  });
  it("names the field a problem is about", () => {
    expect(check({ name: "" })).toMatchObject({ field: "name" });
    expect(check({ name: "x".repeat(81) })).toMatchObject({ field: "name" });
    expect(check({ tagline: "x".repeat(141) })).toMatchObject({ field: "tagline" });
    expect(check({ domain: "x".repeat(501) })).toMatchObject({ field: "domain" });
    expect(check({ aims: Array.from({ length: 11 }, () => "a") })).toMatchObject({ field: "aims" });
    expect(check({ aims: ["x".repeat(201)] })).toMatchObject({ field: "aims" });
  });
  it("validateChanges returns just the message", () => {
    expect(validateChanges(c, { name: "" }, circles)).toBe("Give the circle a name.");
  });

  describe("type", () => {
    it("allows circle, collective and cooperative", () => {
      expect(check({ type: "collective" })).toBeNull();
      expect(check({ type: "cooperative" })).toBeNull();
    });
    it("refuses other, group and neighborhood as a target", () => {
      for (const type of ["other", "group", "neighborhood"] as const) expect(check({ type })).toMatchObject({ field: "type" });
    });
    it("refuses changing a group or a neighborhood at all", () => {
      expect(check({ type: "circle" }, defined({ type: "group" }))).toMatchObject({ field: "type" });
      expect(check({ type: "circle" }, defined({ type: "neighborhood" }))).toMatchObject({ field: "type" });
    });
  });

  describe("parent", () => {
    it("allows a neighborhood or the city", () => {
      expect(check({ parentId: "city" })).toBeNull();
    });
    it("refuses a circle that isn't a neighborhood or the city", () => {
      expect(check({ parentId: "coop" })).toMatchObject({ field: "parentId" });
    });
    it("refuses moving the city", () => {
      const root = defined({ parentId: null });
      expect(check({ parentId: "the903" }, root)).toMatchObject({ field: "parentId" });
    });
  });

  describe("a circle started inside another", () => {
    const inner = defined({ id: "inner", parentId: "coop" });
    it("stays a Circle", () => {
      expect(check({ type: "collective" }, inner)).toMatchObject({ field: "type", message: expect.stringContaining("Co-op") });
    });
    it("stays where it is", () => {
      expect(check({ parentId: "city" }, inner)).toMatchObject({ field: "parentId", message: expect.stringContaining("Co-op") });
    });
    it("can still change other things", () => {
      expect(check({ name: "Renamed", type: "circle" }, inner)).toBeNull();
    });
  });

  describe("inbox", () => {
    it("is allowed on a Circle, a collective and a co-op", () => {
      expect(check({ inbox: true })).toBeNull();
      expect(check({ inbox: true }, defined({ type: "collective" }))).toBeNull();
    });
    it("is refused on a group, and turning it off is always fine", () => {
      expect(check({ inbox: true }, defined({ type: "group" }))).toMatchObject({ field: "inbox" });
      expect(check({ inbox: false }, defined({ type: "group" }))).toBeNull();
    });
    it("judges by the type it would become", () => {
      expect(check({ inbox: true, type: "collective" })).toBeNull();
    });
  });

  describe("public", () => {
    const group = (over: Partial<Circle> = {}) => defined({ type: "group", ...over });
    it("is a group's to decide, and a change only if it differs", () => {
      expect(changedFields(group(), { public: true })).toEqual({ public: true });
      expect(changedFields(group({ public: true }), { public: true })).toEqual({});
      expect(check({ public: true })).toMatchObject({ field: "public" });
      expect(check({ public: true }, group())).toBeNull();
    });
    it("reads as Visibility, and titles itself", () => {
      expect(describeChanges(group(), { public: true }, [], () => "")).toEqual([{ label: "Visibility", before: "Private", after: "Public" }]);
      expect(proposalTitle({ kind: "change", changes: { public: false }, lines: [] })).toBe("Make the group private");
    });
  });

  describe("features", () => {
    const group = (features: GroupFeature[] = []) => defined({ type: "group", features });
    it("are a group's to switch on, and only a change counts", () => {
      expect(changedFields(group(), { features: ["tasks", "wiki"] })).toEqual({ features: ["wiki", "tasks"] });
      expect(changedFields(group(["wiki"]), { features: ["wiki"] })).toEqual({});
    });
    it("are refused on any other circle", () => {
      expect(check({ features: ["wiki"] })).toMatchObject({ field: "features" });
      expect(check({ features: ["wiki"] }, group())).toBeNull();
    });
    it("read as one line each", () => {
      expect(describeChanges(group(["wiki"]), { features: ["tasks"] }, [], () => "")).toEqual([
        { label: "Wiki", before: "On", after: "Off" },
        { label: "Tasks", before: "Off", after: "On" },
      ]);
    });
  });

  describe("roles", () => {
    it("refuses a circle without roles, a group's until it switches them on", () => {
      expect(check({ roles: [] }, defined({ type: "group" }))).toMatchObject({ field: "roles" });
      expect(check({ roles: [] }, defined({ type: "group", features: ["roles"] }))).toBeNull();
    });
    it("only members can hold a role", () => {
      expect(check({ roles: [{ label: "Leader", memberId: 99 }] })).toMatchObject({ field: "roles" });
    });
    it("a Delegate needs a Circle, judged by the type it becomes", () => {
      const roles = [{ label: "Delegate", memberId: 1 }];
      expect(check({ roles }, defined({ type: "collective", roles: [] }))).toMatchObject({ field: "roles" });
      expect(check({ roles, type: "circle" }, defined({ type: "collective", roles: [] }))).toBeNull();
    });
  });
});

describe("checkCircleBasics", () => {
  it("only applies to a Circle", () => {
    expect(checkCircleBasics(defined({ type: "collective", domain: undefined, aims: [] }), { domain: "" })).toBeNull();
  });
  it("ignores a proposal that isn't about what defines it", () => {
    expect(checkCircleBasics(defined({ domain: undefined, aims: [] }), { name: "New", roles: [] })).toBeNull();
  });
  it("needs a domain once its type, domain or aims change", () => {
    expect(checkCircleBasics(defined(), { domain: "  " })).toMatchObject({ field: "domain" });
    expect(checkCircleBasics(defined({ domain: undefined }), { aims: ["x"] })).toMatchObject({ field: "domain" });
  });
  it("needs an aim", () => {
    expect(checkCircleBasics(defined(), { aims: [] })).toMatchObject({ field: "aims" });
    expect(checkCircleBasics(defined({ aims: [] }), { domain: "Somewhere" })).toMatchObject({ field: "aims" });
  });
  it("becoming a Circle needs both", () => {
    const coop = defined({ type: "collective", domain: undefined, aims: undefined });
    expect(checkCircleBasics(coop, { type: "circle" })).toMatchObject({ field: "domain" });
    expect(checkCircleBasics(coop, { type: "circle", domain: "D" })).toMatchObject({ field: "aims" });
    expect(checkCircleBasics(coop, { type: "circle", domain: "D", aims: ["A"] })).toBeNull();
  });
});

describe("describeChanges", () => {
  const names: Record<number, string> = { 1: "Ada", 2: "Bo" };
  const who = (id: number) => names[id] ?? "?";
  const c = defined();
  const circles = world(c);

  it("gives a before and after for each field", () => {
    const lines = describeChanges(c, { name: "Allotment", type: "collective", inbox: true, domain: "D2", aims: ["a", "b"] }, circles, who);
    expect(lines).toEqual([
      { label: "Name", before: "Garden", after: "Allotment" },
      { label: "Type", before: "Circle", after: "Collective" },
      { label: "Domain", before: "The community garden", after: "D2" },
      { label: "Aims", before: "Grow food", after: "a; b" },
      { label: "Inbox", before: "Off", after: "On" },
    ]);
  });
  it("names the city as the whole city", () => {
    const [line] = describeChanges(c, { parentId: "city" }, circles, who);
    expect(line).toEqual({ label: "Parent Circle", before: "The 903", after: "Providence (the whole city)" });
  });
  it("describes role changes: reassigned, added, and removed (but never a built-in)", () => {
    const roles = [
      { label: "Secretary", memberId: 2 }, // was empty
      { label: "Leader", memberId: 1 }, // unchanged
      { label: "Treasurer", memberId: 2 }, // new
    ];
    const withOwn = defined({ roles: [...c.roles!, { label: "Scribe", builtin: false, memberId: 1 }] });
    const lines = describeChanges(withOwn, { roles }, world(withOwn), who);
    expect(lines).toEqual([
      { label: "Secretary", before: "Unassigned", after: "Bo" },
      { label: "New role: Treasurer", before: "", after: "Bo" },
      { label: "Removed role: Scribe", before: "Ada", after: "" },
    ]);
  });
});

describe("neighborhood consent", () => {
  const t = tree();
  const byId = indexCircles(Object.values(t));
  const elsewhere = circle({ id: "elsewhere", type: "neighborhood", parentId: "city", members: [] });
  const byId2 = indexCircles([...Object.values(t), elsewhere]);

  it("needs none unless it is, or becomes, a Circle", () => {
    expect(neighborhoodConsentFor(t.coop, { parentId: "the903" }, byId)).toBeNull();
  });
  it("a circle becoming a Circle in a neighborhood needs that neighborhood", () => {
    const c = circle({ id: "c", type: "collective", parentId: "the903" });
    expect(neighborhoodConsentFor(c, { type: "circle" }, byId)?.id).toBe("the903");
  });
  it("a Circle moving into a neighborhood needs it", () => {
    const c = circle({ id: "c", type: "circle", parentId: "city" });
    expect(neighborhoodConsentFor(c, { parentId: "the903" }, byId)?.id).toBe("the903");
  });
  it("moving between neighborhoods needs the destination's", () => {
    const c = circle({ id: "c", type: "circle", parentId: "the903" });
    expect(neighborhoodConsentFor(c, { parentId: "elsewhere" }, byId2)?.id).toBe("elsewhere");
  });
  it("a Circle leaving for the city needs no one", () => {
    const c = circle({ id: "c", type: "circle", parentId: "the903" });
    expect(neighborhoodConsentFor(c, { parentId: "city" }, byId)).toBeNull();
  });
  it("a Circle staying put needs no one", () => {
    const c = circle({ id: "c", type: "circle", parentId: "the903" });
    expect(neighborhoodConsentFor(c, { name: "New" }, byId)).toBeNull();
  });
  it("a Circle becoming something else needs no one", () => {
    const c = circle({ id: "c", type: "circle", parentId: "the903" });
    expect(neighborhoodConsentFor(c, { type: "collective" }, byId)).toBeNull();
  });
  it("a new Circle in a neighborhood needs it; other kinds and citywide don't", () => {
    expect(newCircleNeighborhood({ type: "circle", parentId: "the903" }, byId)?.id).toBe("the903");
    expect(newCircleNeighborhood({ type: "collective", parentId: "the903" }, byId)).toBeNull();
    expect(newCircleNeighborhood({ type: "circle", parentId: "city" }, byId)).toBeNull();
  });
  it("a Circle inside a Circle in a neighborhood counts that neighborhood", () => {
    expect(newCircleNeighborhood({ type: "circle", parentId: "council" }, byId)?.id).toBe("the903");
  });
});

describe("newCircleDecider", () => {
  const t = tree();
  const byId = indexCircles(Object.values(t));
  it("a circle that can have circles decides what's started inside it", () => {
    expect(newCircleDecider({ type: "circle", parentId: "council" }, byId)).toMatchObject({ by: "parent", circle: { id: "council" } });
    expect(newCircleDecider({ type: "circle", parentId: "coop" }, byId)).toMatchObject({ by: "parent", circle: { id: "coop" } });
  });
  it("otherwise a neighborhood decides a new Circle", () => {
    expect(newCircleDecider({ type: "circle", parentId: "the903" }, byId)).toMatchObject({ by: "neighborhood", circle: { id: "the903" } });
  });
  it("anything else is just created", () => {
    expect(newCircleDecider({ type: "collective", parentId: "the903" }, byId)).toBeNull();
    expect(newCircleDecider({ type: "circle", parentId: "city" }, byId)).toBeNull();
  });
});

describe("proposalTitle", () => {
  const base = { kind: "change" as const, lines: [] };
  it("renames", () => expect(proposalTitle({ ...base, changes: { name: "Ona" } })).toBe("Rename to Ona"));
  it("lists several fields", () => {
    expect(proposalTitle({ ...base, changes: { name: "Ona", type: "collective", roles: [] } })).toBe("Change the name, type and roles");
  });
  it("names one other field", () => expect(proposalTitle({ ...base, changes: { tagline: "x" } })).toBe("Change the tagline"));
  it("the Inbox alone", () => {
    expect(proposalTitle({ ...base, changes: { inbox: true } })).toBe("Turn on the Inbox");
    expect(proposalTitle({ ...base, changes: { inbox: false } })).toBe("Turn off the Inbox");
  });
  it("the Inbox with other things is a change", () => {
    expect(proposalTitle({ ...base, changes: { name: "x", inbox: true } })).toBe("Change the name and Inbox");
  });
  it("an event, a post, a new circle and a chat removal", () => {
    expect(proposalTitle({ kind: "event", changes: {}, lines: [{ label: "Title", before: "", after: "Coffee" }] })).toBe("Schedule Coffee");
    expect(proposalTitle({ kind: "post", changes: {}, lines: [{ label: "Post", before: "", after: "Survey" }] })).toBe("Post “Survey”");
    expect(proposalTitle({ kind: "new_circle", changes: { name: "Tenants" }, lines: [] })).toBe("Start Tenants");
    expect(proposalTitle({ kind: "new_circle", changes: {}, lines: [] })).toBe("Start a Circle");
    expect(proposalTitle({ kind: "remove_message", changes: {}, lines: [{ label: "Message", before: "", after: "x" }, { label: "Written by", before: "", after: "Ada" }] })).toBe("Remove a message by Ada");
  });
});

describe("responses", () => {
  const p = proposal({ responses: [answer(1, "like"), answer(2, "accept"), answer(3, "object")] });
  it("responseOf finds a member's answer", () => {
    expect(responseOf(p, 2)?.response).toBe("accept");
    expect(responseOf(p, 9)).toBeUndefined();
  });
  it("everyoneConsented: like and accept consent, object and silence don't", () => {
    expect(everyoneConsented(p, [1, 2])).toBe(true);
    expect(everyoneConsented(p, [1, 2, 3])).toBe(false);
    expect(everyoneConsented(p, [1, 4])).toBe(false);
    expect(everyoneConsented(p, [])).toBe(true);
  });
  it("awaitingResponse: open, not the proposer's, not yet answered", () => {
    const open = proposal({ proposerId: 1, responses: [answer(2, "like")] });
    expect(awaitingResponse(open, 1)).toBe(false);
    expect(awaitingResponse(open, 2)).toBe(false);
    expect(awaitingResponse(open, 3)).toBe(true);
    expect(awaitingResponse({ ...open, status: "passed" }, 3)).toBe(false);
  });
});

describe("openProposalsFor", () => {
  const a = proposal({ id: "a", closesAt: "2026-11-06T00:00:00Z" });
  const b = proposal({ id: "b", closesAt: "2026-11-04T00:00:00Z" });
  const about = proposal({ id: "about", circleId: "the903", subjectCircleId: "c", closesAt: "2026-11-05T00:00:00Z" });
  const closed = proposal({ id: "closed", status: "passed" });
  const other = proposal({ id: "other", circleId: "elsewhere" });
  it("includes what it decides and what's about it, soonest to close first", () => {
    expect(openProposalsFor([a, other, closed, about, b], "c").map((p) => p.id)).toEqual(["b", "about", "a"]);
  });
});

describe("describe* helpers", () => {
  it("describeEventProposal: includes optional lines only when present", () => {
    const base = { title: "Coffee", kind: "ordinary" as const, date: "2026-11-10", start: "10:00", end: "12:00", location: "Park", description: "  ", repeat: undefined, agenda: undefined };
    const labels = (e: Parameters<typeof describeEventProposal>[0], slots: string[] = []) => describeEventProposal(e, slots).map((l) => l.label);
    expect(labels(base)).toEqual(["Title", "When", "Where"]);
    expect(labels({ ...base, kind: "meeting", agenda: [{ category: "decide", title: "Budget" }], description: "" })).toEqual(["Title", "Kind", "When", "Where", "Agenda"]);
    expect(labels({ ...base, description: "Bring mugs" }, ["Host", "Setup"])).toEqual(["Title", "When", "Where", "Roles", "Details"]);
    expect(describeEventProposal({ ...base, kind: "meeting", agenda: [{ category: "decide", title: "Budget" }, { category: "report", title: "News" }] }, []).find((l) => l.label === "Agenda")?.after).toBe("1. Decide: Budget\n2. Report: News");
  });
  it("describeChatRemoval truncates a long quote", () => {
    const [msg] = describeChatRemoval("x".repeat(600), "Ada", "Garden");
    expect(msg?.after).toHaveLength(501);
    expect(msg?.after.endsWith("…")).toBe(true);
    expect(describeChatRemoval("  hi  ", "Ada", "Garden")[0]?.after).toBe("hi");
    expect(describeChatRemoval("hi", "Ada", "Garden")[2]?.after).toBe("Garden's chat");
  });
  it("describePostProposal leaves the link off an announcement", () => {
    const link = describePostProposal({ title: "Survey", icon: "survey", url: "https://x.org", message: undefined }, "The 903", "Survey");
    expect(link.map((l) => l.label)).toEqual(["Post", "Where", "Kind", "Link"]);
    const ann = describePostProposal({ title: "Hello", icon: "announcement", url: undefined, message: "Hi all" }, "The 903", "Announcement");
    expect(ann.map((l) => l.label)).toEqual(["Post", "Where", "Kind", "Message"]);
  });
  it("describeNewCircle trims, drops blank aims and adds the delegate", () => {
    const lines = describeNewCircle({ type: "circle", name: " Tenants ", tagline: " ", parentId: "the903", domain: " Rent ", aims: [" Fair rent ", ""] }, "The 903", "Ada");
    expect(lines).toEqual([
      { label: "Name", before: "", after: "Tenants" },
      { label: "Type", before: "", after: "Circle" },
      { label: "Domain", before: "", after: "Rent" },
      { label: "Aims", before: "", after: "Fair rent" },
      { label: "Where", before: "", after: "The 903" },
      { label: "Delegate", before: "", after: "Ada" },
    ]);
  });
});
