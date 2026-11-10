import { describe, expect, it } from "vitest";
import {
  audienceLabel,
  checkNewCircle,
  circleAncestors,
  circleCanHaveCircles,
  circleCanHaveInbox,
  circleCanHoldMeetings,
  circleChildren,
  circleContact,
  circleDescendantIds,
  circleHasChat,
  circleHasInbox,
  circleHasPage,
  circleHasTasks,
  circleHasPublicWiki,
  circleHasWiki,
  cleanFeatures,
  circleNeighborhood,
  circleSections,
  circleWebsiteUrl,
  circlesByKind,
  circlesForAudience,
  circlesForMember,
  cleanAims,
  defaultCircleSection,
  hostCanShowTo,
  indexCircles,
  isCircleAudience,
  isCircleMember,
  isCircleSection,
  isWithinCircle,
  memberCirclesWithPaths,
  parentCircleOptions,
  parentCircleRefusal,
  postingCirclesFor,
  postsToNeighborhood,
  sharesCircleWith,
  startedInside,
  validateNewCircle,
  type NewCircleInput,
} from "./circles.util";
import { circle, tree } from "./test/factories";
import type { GroupFeature } from "./types";

const t = tree();
const all = Object.values(t);
const byId = indexCircles(all);
const parentOf = (id: string) => byId[id]?.parentId;

describe("which circles get which features", () => {
  it("a page: everything but a neighborhood and the city", () => {
    expect(circleHasPage(t.council)).toBe(true);
    expect(circleHasPage(t.club)).toBe(true);
    expect(circleHasPage(t.the903)).toBe(false);
    expect(circleHasPage(t.city)).toBe(false);
  });
  it("a group has a wiki and tasks once it switches them on", () => {
    const on = { ...t.club, features: ["wiki", "tasks"] as GroupFeature[] };
    expect(circleHasWiki(on)).toBe(true);
    expect(circleHasTasks(on)).toBe(true);
    expect(circleCanHoldMeetings(on)).toBe(false);
    expect(circleHasPublicWiki(on)).toBe(false);
    expect(circleHasPublicWiki(t.council)).toBe(true);
    expect(cleanFeatures(["tasks", "bogus", "wiki", "wiki"])).toEqual(["wiki", "tasks"]);
  });
  it("a group has no wiki or tasks by default but keeps chat", () => {
    expect(circleHasWiki(t.club)).toBe(false);
    expect(circleHasTasks(t.club)).toBe(false);
    expect(circleHasChat(t.club)).toBe(true);
    expect(circleHasWiki(t.council)).toBe(true);
    expect(circleHasTasks(t.council)).toBe(true);
  });
  it("neither a neighborhood nor the city has tasks or chat", () => {
    expect(circleHasTasks(t.the903)).toBe(false);
    expect(circleHasChat(t.city)).toBe(false);
  });
  it("only a Circle, a collective or a co-op can have an Inbox, and it must be on", () => {
    expect(circleCanHaveInbox(t.council)).toBe(true);
    expect(circleCanHaveInbox(t.coop)).toBe(true);
    expect(circleCanHaveInbox(t.club)).toBe(false);
    expect(circleCanHaveInbox(t.the903)).toBe(false);
    expect(circleHasInbox(t.council)).toBe(false);
    expect(circleHasInbox({ ...t.council, inbox: true })).toBe(true);
    expect(circleHasInbox({ ...t.club, inbox: true })).toBe(false);
  });
  it("circles can have circles unless they're groups, neighborhoods or the city", () => {
    expect(circleCanHaveCircles(t.council)).toBe(true);
    expect(circleCanHaveCircles(t.coop)).toBe(true);
    expect(circleCanHaveCircles(t.club)).toBe(false);
    expect(circleCanHaveCircles(t.the903)).toBe(false);
    expect(circleCanHaveCircles(t.city)).toBe(false);
    expect(circleCanHaveCircles(circle({ id: "o", type: "other" }))).toBe(false);
  });
  it("a group can't hold a meeting until it switches them on", () => {
    expect(circleCanHoldMeetings(t.club)).toBe(false);
    expect(circleCanHoldMeetings({ ...t.club, features: ["meetings"] })).toBe(true);
    expect(circleCanHoldMeetings(t.council)).toBe(true);
  });
});

describe("sections", () => {
  it("a non-member gets the public ones", () => {
    expect(circleSections(t.council, false)).toEqual(["wiki", "members", "events"]);
  });
  it("a member also gets the private ones, in order", () => {
    expect(circleSections(t.council, true)).toEqual(["bulletin", "chat", "tasks", "decisions", "wiki", "members", "events"]);
  });
  it("the Inbox shows only while it's on", () => {
    expect(circleSections({ ...t.council, inbox: true }, true)).toContain("inbox");
    expect(circleSections({ ...t.council, inbox: true }, false)).not.toContain("inbox");
  });
  it("a group has no wiki or tasks until it switches them on", () => {
    expect(circleSections(t.club, true)).toEqual(["bulletin", "chat", "decisions", "members", "events"]);
    expect(circleSections({ ...t.club, features: ["wiki", "tasks"] }, true)).toEqual(["bulletin", "chat", "tasks", "decisions", "wiki", "members", "events"]);
  });
  it("opens on the bulletin for a member, the wiki otherwise, and members for a group's outsider", () => {
    expect(defaultCircleSection(t.council, true)).toBe("bulletin");
    expect(defaultCircleSection(t.council, false)).toBe("wiki");
    expect(defaultCircleSection(t.club, false)).toBe("members");
  });
  it("isCircleSection", () => {
    expect(isCircleSection("wiki")).toBe(true);
    expect(isCircleSection("admin")).toBe(false);
    expect(isCircleSection(undefined)).toBe(false);
  });
});

describe("membership and audience", () => {
  it("isCircleMember is explicit membership only", () => {
    expect(isCircleMember(t.council, 1)).toBe(true);
    expect(isCircleMember(t.council, 3)).toBe(false);
    expect(isCircleMember(t.city, 99)).toBe(false);
    expect(isCircleMember(undefined, 1)).toBe(false);
  });
  it("the audience of the city is everyone; of anything else, its members", () => {
    expect(isCircleAudience(t.city, 99)).toBe(true);
    expect(isCircleAudience(t.council, 1)).toBe(true);
    expect(isCircleAudience(t.council, 3)).toBe(false);
    expect(isCircleAudience(undefined, 1)).toBe(false);
  });
  it("circlesForAudience includes the city and the member's own", () => {
    expect(circlesForAudience(3, all).map((c) => c.id).sort()).toEqual(["city", "club", "coop", "the903"]);
  });
  it("audienceLabel", () => {
    expect(audienceLabel(t.city)).toBe("everyone");
    expect(audienceLabel(t.the903)).toBe("residents of The 903");
    expect(audienceLabel(t.council)).toBe("members of Council");
  });
  it("circlesForMember is explicit rows only (not the city for everyone)", () => {
    expect(circlesForMember(99, all)).toEqual([]);
    expect(circlesForMember(1, all).map((c) => c.id).sort()).toEqual(["city", "council", "the903"]);
  });
  it("sharesCircleWith needs a circle with both", () => {
    expect(sharesCircleWith(1, 2, all)).toBe(true);
    expect(sharesCircleWith(1, 99, all)).toBe(false);
    expect(sharesCircleWith(3, 4, all)).toBe(true); // both in the city row
    expect(sharesCircleWith(1, 3, all)).toBe(true); // the 903
    expect(sharesCircleWith(99, 98, [circle({ id: "x", members: [] })])).toBe(false);
  });
});

describe("tree helpers", () => {
  it("indexCircles", () => expect(Object.keys(byId).sort()).toEqual(["city", "club", "coop", "council", "the903"]));
  it("circleChildren is one level", () => {
    expect(circleChildren(t.city, all).map((c) => c.id).sort()).toEqual(["club", "coop", "the903"]);
  });
  it("circleDescendantIds is the whole subtree, not the circle", () => {
    expect(circleDescendantIds(t.city, all).sort()).toEqual(["club", "coop", "council", "the903"]);
    expect(circleDescendantIds(t.council, all)).toEqual([]);
  });
  it("circleAncestors runs from the city down", () => {
    expect(circleAncestors(t.council, byId).map((c) => c.id)).toEqual(["city", "the903"]);
    expect(circleAncestors(t.city, byId)).toEqual([]);
  });
  it("isWithinCircle includes itself and descendants only", () => {
    expect(isWithinCircle("council", "council", parentOf)).toBe(true);
    expect(isWithinCircle("council", "the903", parentOf)).toBe(true);
    expect(isWithinCircle("council", "city", parentOf)).toBe(true);
    expect(isWithinCircle("the903", "council", parentOf)).toBe(false);
    expect(isWithinCircle("coop", "the903", parentOf)).toBe(false);
  });
  it("a parent cycle can't loop forever", () => {
    const cyc: Record<string, string> = { a: "b", b: "a" };
    expect(isWithinCircle("a", "zzz", (id) => cyc[id])).toBe(false);
    const looped = indexCircles([circle({ id: "a", parentId: "b" }), circle({ id: "b", parentId: "a" })]);
    expect(circleAncestors(looped.a!, looped).length).toBeLessThanOrEqual(64);
  });
  it("circleNeighborhood: itself, the nearest ancestor, or null for citywide", () => {
    expect(circleNeighborhood(t.the903, byId)?.id).toBe("the903");
    expect(circleNeighborhood(t.council, byId)?.id).toBe("the903");
    expect(circleNeighborhood(t.coop, byId)).toBeNull();
    expect(circleNeighborhood(t.city, byId)).toBeNull();
  });
  it("startedInside is the parent that can have circles", () => {
    expect(startedInside(circle({ id: "x", parentId: "coop" }), byId)?.id).toBe("coop");
    expect(startedInside(circle({ id: "x", parentId: "the903" }), byId)).toBeNull();
    expect(startedInside(circle({ id: "x", parentId: "city" }), byId)).toBeNull();
    expect(startedInside(circle({ id: "x", parentId: null }), byId)).toBeNull();
  });
});

describe("hosting", () => {
  it("a circle can host events shown to itself or above it", () => {
    expect(hostCanShowTo(t.council, "council", parentOf)).toBe(true);
    expect(hostCanShowTo(t.council, "the903", parentOf)).toBe(true);
    expect(hostCanShowTo(t.council, "city", parentOf)).toBe(true);
    expect(hostCanShowTo(t.council, "coop", parentOf)).toBe(false);
  });
  it("a group's events are shown only to the group, or it'd be revealed", () => {
    expect(hostCanShowTo(t.club, "club", parentOf)).toBe(true);
    expect(hostCanShowTo(t.club, "city", parentOf)).toBe(false);
  });
});

describe("neighborhood bulletins", () => {
  it("only a Circle placed directly in a neighborhood posts to it", () => {
    expect(postsToNeighborhood(t.council, byId)?.id).toBe("the903");
    expect(postsToNeighborhood(t.coop, byId)).toBeNull();
    const nested = circle({ id: "nested", type: "circle", parentId: "council" });
    expect(postsToNeighborhood(nested, indexCircles([...all, nested]))).toBeNull();
    const citywide = circle({ id: "cw", type: "circle", parentId: "city" });
    expect(postsToNeighborhood(citywide, indexCircles([...all, citywide]))).toBeNull();
  });
  it("postingCirclesFor: the member's circles that post there", () => {
    expect(postingCirclesFor(1, t.the903, all).map((c) => c.id)).toEqual(["council"]);
    expect(postingCirclesFor(3, t.the903, all)).toEqual([]);
  });
});

describe("parent options", () => {
  it("neighborhoods alphabetically, then the city; minus the circle being edited", () => {
    const b = circle({ id: "b", type: "neighborhood", name: "Another" });
    const options = parentCircleOptions([...all, b]);
    expect(options.map((c) => c.id)).toEqual(["b", "the903", "city"]);
    expect(parentCircleOptions(all, "the903").map((c) => c.id)).toEqual(["city"]);
    expect(parentCircleOptions(all, "city").map((c) => c.id)).toEqual(["the903"]);
  });
  it("refusal: itself, inside itself, or not a neighborhood/the city", () => {
    expect(parentCircleRefusal(t.council, byId, "council")).toBe("This circle");
    expect(parentCircleRefusal(t.council, byId, "the903")).toBe("Inside this circle");
    expect(parentCircleRefusal(t.coop, byId, "council")).toMatch(/neighborhood or the whole city/);
    expect(parentCircleRefusal(t.the903, byId, "council")).toBeNull();
    expect(parentCircleRefusal(t.city, byId, "council")).toBeNull();
  });
});

describe("circlesByKind", () => {
  it("orders the headings and drops empty ones", () => {
    const groups = circlesByKind(all);
    expect(groups.map((g) => g.label)).toEqual(["Citywide", "Neighborhoods", "Circles", "Groups", "Organizations"]);
    expect(circlesByKind([t.coop]).map((g) => g.label)).toEqual(["Organizations"]);
  });
});

describe("new circles", () => {
  const input = (over: Partial<NewCircleInput> = {}): NewCircleInput => ({ type: "collective", name: "Tenants", tagline: "", parentId: "the903", ...over });
  const check = (over: Partial<NewCircleInput> = {}) => checkNewCircle(input(over), all);

  it("accepts a plain collective in a neighborhood or the city", () => {
    expect(check()).toBeNull();
    expect(check({ parentId: "city" })).toBeNull();
    expect(validateNewCircle(input(), all)).toBeNull();
  });
  it("only creatable types", () => {
    expect(check({ type: "neighborhood" })).toMatchObject({ field: "type" });
    expect(check({ type: "other" })).toMatchObject({ field: "type" });
    expect(check({ type: "group" })).toBeNull();
  });
  it("name and tagline", () => {
    expect(check({ name: "  " })).toMatchObject({ field: "name" });
    expect(check({ name: "x".repeat(81) })).toMatchObject({ field: "name" });
    expect(check({ tagline: "x".repeat(141) })).toMatchObject({ field: "tagline" });
  });
  it("a Circle needs a domain and an aim", () => {
    const circleIn = { type: "circle" as const, domain: "Rent", aims: ["Fair rent"] };
    expect(check(circleIn)).toBeNull();
    expect(check({ ...circleIn, domain: " " })).toMatchObject({ field: "domain" });
    expect(check({ ...circleIn, aims: [" ", ""] })).toMatchObject({ field: "aims" });
    expect(check({ ...circleIn, aims: Array.from({ length: 11 }, () => "a") })).toMatchObject({ field: "aims" });
    expect(check({ ...circleIn, aims: ["x".repeat(201)] })).toMatchObject({ field: "aims" });
    expect(check({ ...circleIn, domain: "x".repeat(501) })).toMatchObject({ field: "domain" });
  });
  it("other types ignore domain and aims", () => {
    expect(check({ domain: "", aims: [] })).toBeNull();
  });
  it("the parent must be a neighborhood or the city", () => {
    expect(check({ parentId: "coop" })).not.toBeNull();
    expect(check({ parentId: "nowhere" })).toMatchObject({ field: "parentId" });
  });
  describe("inside a circle", () => {
    const inside = { type: "circle" as const, domain: "D", aims: ["A"], parentId: "council" };
    it("must be a Circle, with a delegate from among its members", () => {
      expect(check({ ...inside, delegateId: 2 })).toBeNull();
      expect(check({ ...inside, type: "collective" })).toMatchObject({ field: "type" });
      expect(check(inside)).toMatchObject({ field: "delegateId" });
      expect(check({ ...inside, delegateId: 3 })).toMatchObject({ field: "delegateId" });
    });
  });
  it("cleanAims trims and drops blanks", () => {
    expect(cleanAims([" a ", "", "  ", "b"])).toEqual(["a", "b"]);
    expect(cleanAims(undefined)).toEqual([]);
  });
});

describe("circleWebsiteUrl", () => {
  it("reads a website with or without a scheme", () => {
    expect(circleWebsiteUrl("example.org")?.href).toBe("https://example.org/");
    expect(circleWebsiteUrl("http://example.org/a")?.href).toBe("http://example.org/a");
    expect(circleWebsiteUrl("  www.example.org  ")?.hostname).toBe("www.example.org");
  });
  it("is null for what isn't a web address", () => {
    expect(circleWebsiteUrl("")).toBeNull();
    expect(circleWebsiteUrl("@ourgarden")).toBeNull();
    expect(circleWebsiteUrl("instagram")).toBeNull();
    expect(circleWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(circleWebsiteUrl("ftp://example.org")).toBeNull();
    expect(circleWebsiteUrl("mailto:a@b.org")).toBeNull();
  });
});

describe("circleContact", () => {
  it("an email becomes mailto:", () => {
    expect(circleContact("hello@garden.org")).toEqual({ kind: "email", href: "mailto:hello@garden.org", display: "hello@garden.org" });
    expect(circleContact("  hello@garden.org ")?.kind).toBe("email");
  });
  it("a phone number becomes tel: with only its digits and a leading +", () => {
    expect(circleContact("(401) 555-0123")).toMatchObject({ kind: "phone", href: "tel:4015550123" });
    expect(circleContact("+1 401 555 0123")).toMatchObject({ kind: "phone", href: "tel:+14015550123" });
    expect(circleContact("401.555.0123")?.kind).toBe("phone");
  });
  it("needs 7 to 15 digits", () => {
    expect(circleContact("555-012")).toBeNull();
    expect(circleContact("1234567")?.kind).toBe("phone");
    expect(circleContact("1".repeat(15))?.kind).toBe("phone");
    expect(circleContact("1".repeat(16))).toBeNull();
  });
  it("isn't fooled by a date, a street address or words", () => {
    expect(circleContact("2026-11-10")).toBeNull();
    expect(circleContact("2026.11.10")).toBeNull();
    expect(circleContact("123 Main St")).toBeNull();
    expect(circleContact("Ask at the front desk")).toBeNull();
    expect(circleContact("call 401-555-0123")).toBeNull();
    expect(circleContact("")).toBeNull();
  });
  it("not an email without a domain dot", () => {
    expect(circleContact("a@b")).toBeNull();
    expect(circleContact("a b@c.org")).toBeNull();
  });
});

describe("memberCirclesWithPaths", () => {
  const ids = (memberId: number) => memberCirclesWithPaths(memberId, Object.values(tree())).map((c) => c.id).sort();

  it("keeps a member's circles, the city and the path down to them", () => {
    expect(ids(1)).toEqual(["city", "council", "the903"]);
    expect(ids(2)).toEqual(["city", "coop", "council", "the903"]);
  });

  it("leaves out circles they aren't in, including groups", () => {
    expect(ids(4)).toEqual(["city"]);
    expect(ids(1)).not.toContain("club");
    expect(ids(3)).toContain("club");
  });
});
