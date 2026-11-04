import { describe, expect, it } from "vitest";
import {
  approvingRole,
  assembleCircleRoles,
  builtinRoleDescription,
  builtinRolesFor,
  circleHasRoles,
  circleIsAccountable,
  isBuiltinRole,
  isDelegateOf,
  rolesHeldBy,
  validateCircleRoles,
} from "./circle-roles.util";

describe("which circles have roles", () => {
  it("not a neighborhood, a group or the city", () => {
    expect(circleHasRoles({ type: "neighborhood", parentId: "city" })).toBe(false);
    expect(circleHasRoles({ type: "group", parentId: "city" })).toBe(false);
    expect(circleHasRoles({ type: "other", parentId: null })).toBe(false);
  });
  it("any other circle", () => {
    for (const type of ["circle", "collective", "cooperative", "other"] as const) expect(circleHasRoles({ type, parentId: "city" })).toBe(true);
  });
  it("only a Circle is accountable, and so has a Delegate", () => {
    expect(circleIsAccountable({ type: "circle" })).toBe(true);
    expect(circleIsAccountable({ type: "collective" })).toBe(false);
    expect(builtinRolesFor("circle")).toEqual(["Secretary", "Leader", "Facilitator", "Delegate"]);
    expect(builtinRolesFor("cooperative")).toEqual(["Secretary", "Leader", "Facilitator"]);
  });
  it("isBuiltinRole ignores case and space, and depends on the type", () => {
    expect(isBuiltinRole(" secretary ", "collective")).toBe(true);
    expect(isBuiltinRole("Delegate", "circle")).toBe(true);
    expect(isBuiltinRole("Delegate", "collective")).toBe(false);
    expect(isBuiltinRole("Treasurer", "circle")).toBe(false);
  });
  it("describes only built-in roles", () => {
    expect(builtinRoleDescription("facilitator")).toMatch(/meetings/);
    expect(builtinRoleDescription("Treasurer")).toBeUndefined();
  });
});

describe("validateCircleRoles", () => {
  const members = [1, 2, 3];
  const ok = (drafts: Parameters<typeof validateCircleRoles>[0], type: Parameters<typeof validateCircleRoles>[2] = "circle") => validateCircleRoles(drafts, members, type);

  it("accepts built-in roles with or without holders, and the circle's own", () => {
    expect(ok([])).toBeNull();
    expect(ok([{ label: "Leader", memberId: 1 }, { label: "Secretary", memberId: null }, { label: "Treasurer", memberId: 2 }])).toBeNull();
  });
  it("needs a name, within the limit, unique ignoring case", () => {
    expect(ok([{ label: "  ", memberId: null }])).toMatch(/name/);
    expect(ok([{ label: "x".repeat(41), memberId: null }])).toMatch(/40/);
    expect(ok([{ label: "Treasurer", memberId: null }, { label: "treasurer ", memberId: null }])).toMatch(/two roles/);
    expect(ok([{ label: "Leader", memberId: null }, { label: "LEADER", memberId: null }])).toMatch(/two roles/);
  });
  it("only a member can hold a role", () => {
    expect(ok([{ label: "Leader", memberId: 9 }])).toMatch(/members of this circle/);
  });
  it("only a Circle has a Delegate", () => {
    expect(ok([{ label: "Delegate", memberId: 1 }], "collective")).toMatch(/Delegate/);
    expect(ok([{ label: "delegate", memberId: null }], "cooperative")).toMatch(/Delegate/);
    expect(ok([{ label: "Delegate", memberId: 1 }], "circle")).toBeNull();
  });
  it("limits the circle's own roles to 20, built-ins not counting", () => {
    const own = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Role ${i}`, memberId: null }));
    const builtins = ["Secretary", "Leader", "Facilitator", "Delegate"].map((label) => ({ label, memberId: null }));
    expect(ok([...builtins, ...own(20)])).toBeNull();
    expect(ok([...builtins, ...own(21)])).toMatch(/20/);
  });
});

describe("assembleCircleRoles", () => {
  const members = [1, 2];
  it("lists every built-in first, empty if nobody holds it, then the circle's own", () => {
    const roles = assembleCircleRoles([{ label: "Treasurer", memberId: 2 }, { label: "Leader", memberId: 1 }], members, "circle");
    expect(roles).toEqual([
      { label: "Secretary", builtin: true, memberId: null },
      { label: "Leader", builtin: true, memberId: 1 },
      { label: "Facilitator", builtin: true, memberId: null },
      { label: "Delegate", builtin: true, memberId: null },
      { label: "Treasurer", builtin: false, memberId: 2 },
    ]);
  });
  it("uses the canonical built-in name whatever case was saved", () => {
    expect(assembleCircleRoles([{ label: "leader", memberId: 1 }], members, "collective").find((r) => r.label === "Leader")?.memberId).toBe(1);
  });
  it("drops a holder who has left the circle", () => {
    const roles = assembleCircleRoles([{ label: "Leader", memberId: 9 }, { label: "Scribe", memberId: 9 }], members, "circle");
    expect(roles.find((r) => r.label === "Leader")?.memberId).toBeNull();
    expect(roles.find((r) => r.label === "Scribe")).toEqual({ label: "Scribe", builtin: false, memberId: null });
  });
  it("loses a Delegate once the circle stops being a Circle", () => {
    const roles = assembleCircleRoles([{ label: "Delegate", memberId: 1 }], members, "collective");
    expect(roles.map((r) => r.label)).toEqual(["Secretary", "Leader", "Facilitator"]);
  });
  it("skips blank names and trims the circle's own", () => {
    const roles = assembleCircleRoles([{ label: "  ", memberId: 1 }, { label: " Scribe ", memberId: 1 }], members, "circle");
    expect(roles.filter((r) => !r.builtin)).toEqual([{ label: "Scribe", builtin: false, memberId: 1 }]);
  });
});

describe("reading who holds what", () => {
  const circle = {
    roles: [
      { label: "Secretary", builtin: true, memberId: 2 },
      { label: "Leader", builtin: true, memberId: 1 },
      { label: "Delegate", builtin: true, memberId: 1 },
      { label: "Scribe", builtin: false, memberId: 1 },
    ],
  };
  it("rolesHeldBy keeps the circle's order", () => {
    expect(rolesHeldBy(circle, 1)).toEqual(["Leader", "Delegate", "Scribe"]);
    expect(rolesHeldBy(circle, 9)).toEqual([]);
    expect(rolesHeldBy({}, 1)).toEqual([]);
  });
  it("approvingRole is the first role held, or null", () => {
    expect(approvingRole(circle, 1)).toBe("Leader");
    expect(approvingRole(circle, 2)).toBe("Secretary");
    expect(approvingRole(circle, 9)).toBeNull();
    expect(approvingRole({}, 1)).toBeNull();
  });
  it("isDelegateOf requires the built-in Delegate role, not a custom role of that name", () => {
    expect(isDelegateOf(circle, 1)).toBe(true);
    expect(isDelegateOf(circle, 2)).toBe(false);
    expect(isDelegateOf({ roles: [{ label: "Delegate", builtin: false, memberId: 1 }] }, 1)).toBe(false);
    expect(isDelegateOf({}, 1)).toBe(false);
  });
});
