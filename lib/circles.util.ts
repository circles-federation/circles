import type { Circle, CircleType } from "./types";

/* Pure helpers for the circle tree — circles nest via `parentId` (another
   circle's id, or null for the root, the city). Extend this module rather than
   duplicating tree-walking logic per component. Membership is always the
   explicit `members` list on a circle; there is no derived roster. */

export type CirclesById = Record<string, Circle>;

// display label per circle type — the eyebrow on a card or page header
export const CIRCLE_TYPE_LABEL: Record<CircleType, string> = {
  neighborhood: "Neighborhood",
  circle: "Circle",
  collective: "Collective",
  cooperative: "Cooperative",
  other: "Other",
  group: "Group",
};

/* The types a member can create a circle as (Create circle), in the order
   offered. Not a neighborhood: its type carries real behavior (members' home
   circles, the folder view) that a new one isn't set up for yet. Nor Other:
   a new circle should say what it is. Existing ones keep it, and Manage
   circle offers it only to them. */
export const CREATABLE_CIRCLE_TYPES: CircleType[] = ["circle", "collective", "cooperative", "group"];

// what each creatable type is, in a line under its name in Create circle's Type list
export const CIRCLE_TYPE_DESCRIPTION: Partial<Record<CircleType, string>> = {
  circle: "Decides things together, like a council.",
  collective: "Runs a shared project, like a tool library.",
  cooperative: "One person, one share, one vote.",
  group: "Private. Only its members know it exists.",
};

export const CIRCLE_NAME_MAX = 80;
export const CIRCLE_TAGLINE_MAX = 140;

// a Circle's (type "circle") domain and aims, which sociocracy defines one by:
// required of one, and decided by consent once it exists (lib/proposals.util.ts)
export const CIRCLE_DOMAIN_MAX = 500;
export const CIRCLE_AIM_MAX = 200;
export const MAX_CIRCLE_AIMS = 10;

export interface NewCircleInput {
  type: CircleType;
  name: string;
  tagline: string;
  parentId: string;
  // a Circle's (type "circle"); ignored for any other type
  domain?: string;
  aims?: string[];
}

/* Where a circle can sit: in a neighborhood, or citywide, under the root —
   general nesting under any circle is future work. Neighborhoods first,
   alphabetically, then the city; `except` leaves out the circle being edited.
   Shared by Create circle and Manage circle's Parent Circle field, and the
   server's check of either. */
export function parentCircleOptions(circles: Circle[], except?: string): Circle[] {
  const root = circles.find((c) => c.parentId === null);
  return circles
    .filter((c) => c.type === "neighborhood" && c.id !== except)
    .sort((a, b) => a.name.localeCompare(b.name))
    .concat(root && root.id !== except ? [root] : []);
}

/* Circles sorted under the headings the Circles browser uses — the city,
   Neighborhoods, Circles, Groups, then Organizations (collectives,
   cooperatives and the rest) — for a picker's optgroups. Keeps the order given
   within each, and leaves out a heading with nothing under it. */
export function circlesByKind(circles: Circle[]): { label: string; circles: Circle[] }[] {
  const kinds: [string, (c: Circle) => boolean][] = [
    ["Citywide", (c) => c.parentId === null],
    ["Neighborhoods", (c) => c.parentId !== null && c.type === "neighborhood"],
    ["Circles", (c) => c.parentId !== null && c.type === "circle"],
    ["Groups", (c) => c.parentId !== null && c.type === "group"],
    ["Organizations", (c) => c.parentId !== null && c.type !== "neighborhood" && c.type !== "circle" && c.type !== "group"],
  ];
  return kinds.map(([label, test]) => ({ label, circles: circles.filter(test) })).filter((g) => g.circles.length > 0);
}

export type NewCircleField = "type" | "name" | "tagline" | "parentId" | "domain" | "aims";

/* What's wrong with a new circle, and which field it's about, or null: the
   form shows it under that field, and lib/db/circles.ts's createCircle is the
   real check (validateNewCircle, the same as just the message). A Circle
   needs a domain and at least one aim, as it does once it exists. */
export function checkNewCircle(input: NewCircleInput, circles: Circle[]): { field: NewCircleField; message: string } | null {
  if (!CREATABLE_CIRCLE_TYPES.includes(input.type)) return { field: "type", message: "Choose what kind of circle this is." };
  const name = input.name.trim();
  if (!name) return { field: "name", message: "Give the circle a name." };
  if (name.length > CIRCLE_NAME_MAX) return { field: "name", message: `Keep the name to ${CIRCLE_NAME_MAX} characters.` };
  if (input.tagline.trim().length > CIRCLE_TAGLINE_MAX) return { field: "tagline", message: `Keep the tagline to ${CIRCLE_TAGLINE_MAX} characters.` };
  if (input.type === "circle") {
    const domain = (input.domain ?? "").trim();
    const aims = cleanAims(input.aims);
    if (!domain) return { field: "domain", message: "Give the circle a domain: the area it decides in." };
    if (domain.length > CIRCLE_DOMAIN_MAX) return { field: "domain", message: `Keep the domain to ${CIRCLE_DOMAIN_MAX} characters.` };
    if (aims.length === 0) return { field: "aims", message: "Give the circle at least one aim." };
    if (aims.length > MAX_CIRCLE_AIMS) return { field: "aims", message: `Keep it to ${MAX_CIRCLE_AIMS} aims or fewer.` };
    if (aims.some((a) => a.length > CIRCLE_AIM_MAX)) return { field: "aims", message: `Keep each aim to ${CIRCLE_AIM_MAX} characters.` };
  }
  if (!parentCircleOptions(circles).some((c) => c.id === input.parentId)) return { field: "parentId", message: "Choose where this circle sits." };
  return null;
}

export function validateNewCircle(input: NewCircleInput, circles: Circle[]): string | null {
  return checkNewCircle(input, circles)?.message ?? null;
}

// aims as they're kept: trimmed, with blank rows dropped
export function cleanAims(aims: string[] | undefined): string[] {
  return (aims ?? []).map((a) => a.trim()).filter((a) => a !== "");
}

/* A group is a circle with fewer features, and private: only its own members
   know it exists (lib/db/circles.ts never sends it to anyone else). It has a
   bulletin, members and invitations, and members may post their own events to
   it, but no wiki, quick facts or roles, and it can't host an event or hold a
   meeting. */
export function isGroup(circle: Pick<Circle, "type">): boolean {
  return circle.type === "group";
}

// what to call a circle in a form's placeholder: its type, or "organization"
// for Other
export function circleTypeNoun(type: CircleType): string {
  return type === "other" ? "organization" : CIRCLE_TYPE_LABEL[type].toLowerCase();
}

// the domain ending its website and email placeholders suggest: .coop for a
// co-op, .org for a collective or circle, .com for anything else
export function circleDomainEnding(type: CircleType): string {
  if (type === "cooperative") return "coop";
  if (type === "collective" || type === "circle") return "org";
  return "com";
}

// the wiki (About, offers and needs, visiting and joining) and quick facts
export function circleHasWiki(circle: Pick<Circle, "type">): boolean {
  return !isGroup(circle);
}

// a backlog of tasks (lib/db/tasks.ts): a circle with a page, but not a group
export function circleHasTasks(circle: Pick<Circle, "type" | "parentId">): boolean {
  return circleHasPage(circle) && !isGroup(circle);
}

// an Inbox: anyone may write to it from its wiki (lib/db/messages.ts). A
// Circle, a collective or a co-op may have one, once its members consent to
// it; not a group, whose page only its members see, nor a neighborhood or
// the city, too many members to answer as one
export function circleCanHaveInbox(circle: Pick<Circle, "type" | "parentId">): boolean {
  return circleHasPage(circle) && (circle.type === "circle" || circle.type === "collective" || circle.type === "cooperative");
}

export function circleHasInbox(circle: Pick<Circle, "type" | "parentId" | "inbox">): boolean {
  return circleCanHaveInbox(circle) && !!circle.inbox;
}

/* A circle page's sections, in the order its tab row shows them, each at
   /circles/[id]/[section]. The bulletin, tasks and inbox are its members'
   alone, with no hint to anyone else; a group has no wiki or tasks, its
   bulletin standing in for them. */
export const CIRCLE_SECTIONS = ["bulletin", "tasks", "inbox", "decisions", "wiki", "members", "events"] as const;
export type CircleSection = (typeof CIRCLE_SECTIONS)[number];
export const CIRCLE_SECTION_LABEL: Record<CircleSection, string> = { bulletin: "Bulletin", tasks: "Tasks", inbox: "Inbox", decisions: "Decisions", wiki: "Wiki", members: "Members", events: "Events" };

export function isCircleSection(value: string | undefined): value is CircleSection {
  return (CIRCLE_SECTIONS as readonly string[]).includes(value ?? "");
}

// the sections someone sees on a circle's page (one with a page: not a
// neighborhood or the city)
export function circleSections(circle: Pick<Circle, "type" | "parentId" | "inbox">, isMember: boolean): CircleSection[] {
  return CIRCLE_SECTIONS.filter((s) => {
    if (s === "bulletin") return isMember;
    if (s === "tasks") return isMember && circleHasTasks(circle);
    if (s === "inbox") return isMember && circleHasInbox(circle);
    // proposals are its members' alone
    if (s === "decisions") return isMember;
    if (s === "wiki") return circleHasWiki(circle);
    return true;
  });
}

// where its page opens, at /circles/[id] itself: a member on the bulletin,
// anyone else on the wiki (a group's members have no wiki, and no one else
// sees a group)
export function defaultCircleSection(circle: Pick<Circle, "type" | "parentId" | "inbox">, isMember: boolean): CircleSection {
  return circleSections(circle, isMember)[0] ?? "members";
}

// a meeting is its circle's members voting, which a group doesn't do (any
// circle but the city can host an event, a group included, by consent: see
// lib/db/proposals.ts)
export function circleCanHoldMeetings(circle: Pick<Circle, "type">): boolean {
  return !isGroup(circle);
}

/* Whether `host` may host an event shown to `circleId`: one shown to itself
   or to a circle it's part of — except a group, which is private, so an
   event it hosts is only ever shown to the group, or it would reveal it. */
export function hostCanShowTo(host: Pick<Circle, "id" | "type">, circleId: string, parentOf: (id: string) => string | null | undefined): boolean {
  return isGroup(host) ? circleId === host.id : isWithinCircle(host.id, circleId, parentOf);
}

export function indexCircles(circles: Circle[]): CirclesById {
  return circles.reduce<CirclesById>((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});
}

export function isCircleMember(circle: Circle | undefined, memberId: number): boolean {
  return !!circle && circle.members.includes(memberId);
}

// the city root is the circle with no parent
/* A circle with a page of its own (CirclePage): everything but a
   neighborhood, whose page is a folder of what's in it, and the city. Only
   these have a bulletin, tasks and invitations, and can be left; a
   neighborhood's and the city's members are the people who live there. */
export function circleHasPage(circle: Pick<Circle, "type" | "parentId">): boolean {
  return circle.type !== "neighborhood" && circle.parentId !== null;
}

export function isRootCircle(circle: Circle): boolean {
  return circle.parentId === null;
}

/* Who an EVENT in this circle is for: its members, plus — for the city root —
   everyone, since everyone is implicitly in the city. This is deliberately not
   isCircleMember: the implicit-root rule applies only to event visibility,
   posting, RSVPs and votes. Rosters, resources, and avatar gating
   (sharesCircleWith) use explicit membership, or every pair of people would
   "share a circle" and un-gate every profile photo. lib/db/events.ts applies
   the same rule in SQL for what a member is sent. */
export function isCircleAudience(circle: Circle | undefined, memberId: number): boolean {
  return !!circle && (isRootCircle(circle) || circle.members.includes(memberId));
}

// who an event in this circle is for, in words: "everyone" for the city,
// otherwise "residents of The 903" / "members of Finance Council"
export function audienceLabel(circle: Circle): string {
  if (isRootCircle(circle)) return "everyone";
  return `${circle.type === "neighborhood" ? "residents" : "members"} of ${circle.name}`;
}

// the circles a member can post an event in: their own, plus the city
export function circlesForAudience(memberId: number, circles: Circle[]): Circle[] {
  return circles.filter((c) => isCircleAudience(c, memberId));
}

// direct children only (one level down)
export function circleChildren(circle: Circle, circles: Circle[]): Circle[] {
  return circles.filter((c) => c.parentId === circle.id);
}

// the neighborhood a circle effectively belongs to: itself if it is one, else
// its nearest neighborhood ancestor; null means citywide (no neighborhood
// above it) — used for the place chip and "local to my neighborhood" checks.
export function circleNeighborhood(circle: Circle, byId: CirclesById): Circle | null {
  let current: Circle | undefined = circle;
  while (current) {
    if (current.type === "neighborhood") return current;
    current = current.parentId ? byId[current.parentId] : undefined;
  }
  return null;
}

/* The circles `memberId` can post to `neighborhood`'s bulletin for: the
   Circles (type "circle") they belong to inside it, however deep (see
   lib/db/neighborhood-posts.ts, which holds the server to the same rule). */
export function postingCirclesFor(memberId: number, neighborhood: Circle, circles: Circle[]): Circle[] {
  const byId = indexCircles(circles);
  return circles.filter((c) => c.type === "circle" && c.id !== neighborhood.id && c.members.includes(memberId) && circleNeighborhood(c, byId)?.id === neighborhood.id);
}

// every circle anywhere below `circle` in the tree (not including itself),
// for flattening a subtree search
export function circleDescendantIds(circle: Circle, circles: Circle[]): string[] {
  const ids: string[] = [];
  const stack = circleChildren(circle, circles);
  while (stack.length) {
    const next = stack.pop()!;
    ids.push(next.id);
    stack.push(...circleChildren(next, circles));
  }
  return ids;
}

// whether `circleId` is `ancestorId` itself or anywhere below it in the tree —
// taking a parent lookup rather than a Circle map so the server, which reads
// bare (id, parentId) rows, can use the same rule as the event form. A circle
// can host an event shown to itself or to a circle above it, never elsewhere.
export function isWithinCircle(circleId: string, ancestorId: string, parentOf: (id: string) => string | null | undefined): boolean {
  let current: string | null | undefined = circleId;
  // bounded, so a corrupt parent cycle can't loop forever
  for (let depth = 0; current && depth < 64; depth++) {
    if (current === ancestorId) return true;
    current = parentOf(current);
  }
  return false;
}

// every circle a member belongs to. Used by Home's "My circles" speed dial
// and by the meeting-proposal form's "Propose for" picker.
export function circlesForMember(memberId: number, circles: Circle[]): Circle[] {
  return circles.filter((c) => c.members.includes(memberId));
}

// two members are in the same "circle" if they share membership in at least
// one circle — including their neighborhood, so simply living in the same
// one counts. Used to gate whether one member can see another's profile photo
// (see components/shared/avatar.tsx).
export function sharesCircleWith(memberId: number, otherId: number, circles: Circle[]): boolean {
  return circles.some((c) => c.members.includes(memberId) && c.members.includes(otherId));
}

// a circle's website is typed freehand, with or without "https://", so it's
// read as a URL either way; null when it isn't an http(s) address at all
export function circleWebsiteUrl(website: string): URL | null {
  const raw = website.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u : null;
  } catch {
    return null;
  }
}

/* A circle's "Get in touch", as something it can link to: an email address
   (mailto:) or a phone number (tel:, with only its digits and a leading +),
   or null for anything else ("Ask at the front desk"), which is shown as
   typed. A number needs at least 7 digits and nothing but the usual phone
   punctuation, so a street address or a date isn't taken for one. */
export type CircleContact = { kind: "email" | "phone"; href: string; display: string };
export function circleContact(contact: string): CircleContact | null {
  const raw = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { kind: "email", href: `mailto:${raw}`, display: raw };
  const digits = raw.replace(/\D/g, "");
  const looksLikeDate = /^\d{4}[-.]\d{1,2}[-.]\d{1,2}$/.test(raw);
  if (/^\+?[\d\s().\-]+$/.test(raw) && !looksLikeDate && digits.length >= 7 && digits.length <= 15) {
    return { kind: "phone", href: `tel:${raw.startsWith("+") ? "+" : ""}${digits}`, display: raw };
  }
  return null;
}
