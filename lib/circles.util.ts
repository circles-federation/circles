import type { Circle, CircleType, CircleFeature } from "./types";

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

/* What a circle's page may hold, which every signed-in member's browser is
   sent whole, so no one member can make the app heavy for everyone. Generous:
   they're ceilings against abuse, not a style guide. */
export const CIRCLE_ABOUT_MAX = 10_000;
export const CIRCLE_JOIN_MAX = 5_000;
export const CIRCLE_SHORT_FIELD_MAX = 300;
export const MAX_CIRCLE_LIST_ITEMS = 50;
export const CIRCLE_LIST_ITEM_MAX = 200;
export const MAX_CIRCLE_PAIRS = 30;
export const CIRCLE_PAIR_PART_MAX = 200;

// what's wrong with a direct edit of a circle's page (its wiki fields), or null
export function validateWikiPatch(p: Partial<Pick<Circle, "about" | "offers" | "needs" | "facts" | "join" | "contact" | "website" | "address" | "hours">>): string | null {
  if (p.about !== undefined && p.about.length > CIRCLE_ABOUT_MAX) return `Keep About to ${CIRCLE_ABOUT_MAX} characters.`;
  if (p.join !== undefined && p.join.length > CIRCLE_JOIN_MAX) return `Keep How to join to ${CIRCLE_JOIN_MAX} characters.`;
  for (const [label, value] of [["website", p.website], ["contact", p.contact], ["address", p.address]] as const) {
    if (value !== undefined && value.length > CIRCLE_SHORT_FIELD_MAX) return `Keep the ${label} to ${CIRCLE_SHORT_FIELD_MAX} characters.`;
  }
  for (const [label, list] of [["offers", p.offers], ["needs", p.needs]] as const) {
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.some((i) => typeof i !== "string")) return `Those ${label} weren't recognized.`;
    if (list.length > MAX_CIRCLE_LIST_ITEMS) return `Keep ${label} to ${MAX_CIRCLE_LIST_ITEMS} items or fewer.`;
    if (list.some((i) => i.length > CIRCLE_LIST_ITEM_MAX)) return `Keep each of the ${label} to ${CIRCLE_LIST_ITEM_MAX} characters.`;
  }
  for (const [label, pairs] of [["quick facts", p.facts], ["hours", p.hours]] as const) {
    if (pairs === undefined) continue;
    if (!Array.isArray(pairs) || pairs.some((x) => !Array.isArray(x) || x.length !== 2 || typeof x[0] !== "string" || typeof x[1] !== "string")) return `Those ${label} weren't recognized.`;
    if (pairs.length > MAX_CIRCLE_PAIRS) return `Keep ${label} to ${MAX_CIRCLE_PAIRS} rows or fewer.`;
    if (pairs.some(([a, b]) => a.length > CIRCLE_PAIR_PART_MAX || b.length > CIRCLE_PAIR_PART_MAX)) return `Keep each of the ${label} to ${CIRCLE_PAIR_PART_MAX} characters.`;
  }
  return null;
}

export interface NewCircleInput {
  type: CircleType;
  name: string;
  tagline: string;
  parentId: string;
  // a Circle's (type "circle"); ignored for any other type
  domain?: string;
  aims?: string[];
  // a circle started inside another (see circleCanHaveCircles): the member of
  // that circle who'll be its first member and its delegate
  delegateId?: number;
}

/* A circle that has grown can break down into circles of its own: a Circle,
   a collective or a co-op, or a public group (not a private one, a neighborhood or the city). Its
   members consent to each, and each sends a delegate up, who becomes one of
   its members (syncDelegate, lib/db/memberships.ts), so its decisions are
   its own members' and its circles' delegates'. A circle started inside one
   is always a Circle, since only a Circle has a Delegate. */
export function circleCanHaveCircles(circle: Pick<Circle, "type" | "parentId" | "public">): boolean {
  return circleHasPage(circle) && (circle.type === "circle" || circle.type === "collective" || circle.type === "cooperative" || (isGroup(circle) && !!circle.public));
}

// the circle this one was started inside, if it was (one that can have
// circles: see above), rather than in a neighborhood or the city
export function startedInside(circle: Pick<Circle, "parentId">, byId: CirclesById): Circle | null {
  const parent = circle.parentId !== null ? byId[circle.parentId] : undefined;
  return parent && circleCanHaveCircles(parent) ? parent : null;
}

/* Where a circle can be put: in a neighborhood, or citywide, under the root.
   A circle inside another is started there by that circle's consent instead
   (circleCanHaveCircles), and stays. Neighborhoods first,
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

/* Why `candidate` can't be a circle's parent, in a few words under it in the
   Federation Explorer, or null when it can: the same rule as
   parentCircleOptions. `editing` is the circle being moved, which can't go
   inside itself. */
export function parentCircleRefusal(candidate: Circle, byId: CirclesById, editing?: string): string | null {
  if (editing && candidate.id === editing) return "This circle";
  if (editing && isWithinCircle(candidate.id, editing, (id) => byId[id]?.parentId)) return "Inside this circle";
  return candidate.parentId === null || candidate.type === "neighborhood" ? null : "Only a neighborhood or the whole city";
}

// the circles above this one, the city first, for a path ("Providence ›
// The 903") that tells two circles of the same name apart
export function circleAncestors<T extends Pick<Circle, "parentId">>(circle: Pick<Circle, "parentId">, byId: Record<string, T>): T[] {
  const path: T[] = [];
  let next = circle.parentId !== null ? byId[circle.parentId] : undefined;
  // bounded, so a corrupt parent cycle can't loop forever
  for (let depth = 0; next && depth < 64; depth++) {
    path.unshift(next);
    next = next.parentId !== null ? byId[next.parentId] : undefined;
  }
  return path;
}

/* Circles sorted under the headings the Circles browser uses — the city,
   Neighborhoods, Circles, Groups, then Organizations (collectives,
   cooperatives and the rest) — for a picker's optgroups. Keeps the order given
   within each, and leaves out a heading with nothing under it. */
export function circlesByKind<T extends Pick<Circle, "parentId" | "type">>(circles: T[]): { label: string; circles: T[] }[] {
  const kinds: [string, (c: T) => boolean][] = [
    ["Citywide", (c) => c.parentId === null],
    ["Neighborhoods", (c) => c.parentId !== null && c.type === "neighborhood"],
    ["Circles", (c) => c.parentId !== null && c.type === "circle"],
    ["Groups", (c) => c.parentId !== null && c.type === "group"],
    ["Organizations", (c) => c.parentId !== null && c.type !== "neighborhood" && c.type !== "circle" && c.type !== "group"],
  ];
  return kinds.map(([label, test]) => ({ label, circles: circles.filter(test) })).filter((g) => g.circles.length > 0);
}

export type NewCircleField = "type" | "name" | "tagline" | "parentId" | "domain" | "aims" | "delegateId";

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
  // inside a circle: a Circle, with a delegate from among its members
  const inside = circles.find((c) => c.id === input.parentId);
  if (inside && circleCanHaveCircles(inside)) {
    if (input.type !== "circle") return { field: "type", message: `A circle inside ${inside.name} is a Circle, so it can send a delegate.` };
    if (input.delegateId === undefined) return { field: "delegateId", message: "Choose its delegate." };
    if (!inside.members.includes(input.delegateId)) return { field: "delegateId", message: `Its delegate has to be a member of ${inside.name}.` };
    return null;
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

/* A group is a circle that starts private: only its own members know it
   exists (lib/db/circles.ts never sends it to anyone else), until they
   consent to making it public, when it's listed and open like any circle. It
   has every feature another circle has, but a wiki, tasks, meetings and roles
   start switched off (any other kind starts with them on), for its members to
   turn on or off by consent (CIRCLE_FEATURES, defaultFeatures).
   While it's private it has no public wiki, Inbox or circles inside it, since
   each would reveal it. */
export function isGroup(circle: Pick<Circle, "type">): boolean {
  return circle.type === "group";
}

// a group that hasn't been made public: only its members know it exists
export function circleIsPrivate(circle: Pick<Circle, "type" | "public">): boolean {
  return isGroup(circle) && !circle.public;
}

export const CIRCLE_FEATURES: readonly { key: CircleFeature; label: string; description: string }[] = [
  { key: "wiki", label: "Wiki", description: "A page about the circle: about, what it offers and needs, quick facts." },
  { key: "tasks", label: "Tasks", description: "A backlog of tasks for its members to share out." },
  { key: "meetings", label: "Meetings", description: "Meetings with an agenda, scheduled by its members' consent." },
  { key: "roles", label: "Roles", description: "Secretary, Facilitator and the like, held by its members." },
];

/* What a circle's type has switched on until its members decide otherwise
   (`Circle.features` unset): everything for any kind of circle but a group,
   which starts with none. */
export function defaultFeatures(type: CircleType): CircleFeature[] {
  return type === "group" ? [] : CIRCLE_FEATURES.map((f) => f.key);
}

// what a circle's type or its members' choice has switched on: a circle that
// has never decided has its type's defaults
export type Featured = { type: CircleType; features?: readonly CircleFeature[] | null };
export function featuresOf(circle: Featured): readonly CircleFeature[] {
  return circle.features ?? defaultFeatures(circle.type);
}

export function circleHasFeature(circle: Featured, feature: CircleFeature): boolean {
  return featuresOf(circle).includes(feature);
}

// the features in CIRCLE_FEATURES' order, each once, nothing unknown
export function cleanFeatures(features: readonly string[]): CircleFeature[] {
  return CIRCLE_FEATURES.map((f) => f.key).filter((k) => features.includes(k));
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
export function circleHasWiki(circle: Featured): boolean {
  return circleHasFeature(circle, "wiki");
}

// whether anyone may read it by its link: never a private group's, whatever it switches on
export function circleHasPublicWiki(circle: Pick<Circle, "parentId" | "public"> & Featured): boolean {
  return circleHasPage(circle) && !circleIsPrivate(circle) && circleHasWiki(circle);
}

// a backlog of tasks (lib/db/tasks.ts): a circle with a page; a group's once it switches them on
export function circleHasTasks(circle: Pick<Circle, "parentId"> & Featured): boolean {
  return circleHasPage(circle) && circleHasFeature(circle, "tasks");
}

// a chat thread (lib/db/chat.ts): a circle with a page, groups included;
// a neighborhood's or the city's members are too many to share one
export function circleHasChat(circle: Pick<Circle, "type" | "parentId">): boolean {
  return circleHasPage(circle);
}

// an Inbox: anyone may write to it from its wiki (lib/db/messages.ts). A
// Circle, a collective or a co-op may have one, once its members consent to
// it, and a group once it's public (a private one's page is seen only by its
// members); never a neighborhood or the city, too many members to answer as one
export function circleCanHaveInbox(circle: Pick<Circle, "type" | "parentId" | "public">): boolean {
  return circleHasPage(circle) && (circle.type === "circle" || circle.type === "collective" || circle.type === "cooperative" || (isGroup(circle) && !!circle.public));
}

export function circleHasInbox(circle: Pick<Circle, "type" | "parentId" | "inbox" | "public">): boolean {
  return circleCanHaveInbox(circle) && !!circle.inbox;
}

/* A circle page's sections, in the order its tab row shows them, each at
   /circles/[id]/[section]. The bulletin, chat, tasks and inbox are its members'
   alone, with no hint to anyone else; a group's wiki and tasks are there once
   it switches them on. */
export const CIRCLE_SECTIONS = ["bulletin", "chat", "tasks", "inbox", "decisions", "wiki", "members", "events"] as const;
export type CircleSection = (typeof CIRCLE_SECTIONS)[number];
export const CIRCLE_SECTION_LABEL: Record<CircleSection, string> = { bulletin: "Bulletin", chat: "Chat", tasks: "Tasks", inbox: "Inbox", decisions: "Decisions", wiki: "Wiki", members: "Members", events: "Events" };

export function isCircleSection(value: string | undefined): value is CircleSection {
  return (CIRCLE_SECTIONS as readonly string[]).includes(value ?? "");
}

// the sections someone sees on a circle's page (one with a page: not a
// neighborhood or the city)
export function circleSections(circle: Pick<Circle, "parentId" | "inbox" | "public"> & Featured, isMember: boolean): CircleSection[] {
  return CIRCLE_SECTIONS.filter((s) => {
    if (s === "bulletin") return isMember;
    if (s === "chat") return isMember && circleHasChat(circle);
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
export function defaultCircleSection(circle: Pick<Circle, "parentId" | "inbox" | "public"> & Featured, isMember: boolean): CircleSection {
  return circleSections(circle, isMember)[0] ?? "members";
}

// a meeting is decided by its circle's consent; a group holds them once it
// switches them on (any circle but the city can host an event, a group
// included, by consent: see lib/db/proposals.ts)
export function circleCanHoldMeetings(circle: Featured): boolean {
  return circleHasFeature(circle, "meetings");
}

/* Whether `host` may host an event shown to `circleId`: one shown to itself
   or to a circle it's part of — except a private group, so an event it hosts
   is only ever shown to the group, or it would reveal it. */
export function hostCanShowTo(host: Pick<Circle, "id" | "type" | "public">, circleId: string, parentOf: (id: string) => string | null | undefined): boolean {
  return circleIsPrivate(host) ? circleId === host.id : isWithinCircle(host.id, circleId, parentOf);
}

export function indexCircles<T extends Pick<Circle, "id"> = Circle>(circles: T[]): Record<string, T> {
  return circles.reduce<Record<string, T>>((acc, c) => {
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

/* The neighborhood whose bulletin `circle` posts to, if any: only a Circle
   (type "circle") placed directly in a neighborhood, since that's what its
   residents consented to. A circle inside another posts through that one. */
export function postsToNeighborhood(circle: Circle, byId: CirclesById): Circle | null {
  const parent = circle.parentId !== null ? byId[circle.parentId] : undefined;
  return circle.type === "circle" && parent?.type === "neighborhood" ? parent : null;
}

/* The circles `memberId` can post to `neighborhood`'s bulletin for (see
   lib/db/neighborhood-posts.ts, which holds the server to the same rule). */
export function postingCirclesFor(memberId: number, neighborhood: Circle, circles: Circle[]): Circle[] {
  const byId = indexCircles(circles);
  return circles.filter((c) => c.members.includes(memberId) && postsToNeighborhood(c, byId)?.id === neighborhood.id);
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

/* The circles a member belongs to, for a field that offers only those, with
   the city and whatever circles lie between it and theirs, since the explorer
   goes down from the city and a circle can't be reached without its path. The
   path's circles are there to open, not to choose. The city is always there:
   everyone is in it, for an event's audience. */
export function memberCirclesWithPaths(memberId: number, circles: Circle[]): Circle[] {
  const byId = indexCircles(circles);
  const keep = new Set<string>();
  for (const c of circles) {
    if (c.parentId === null) keep.add(c.id);
    else if (c.members.includes(memberId)) {
      keep.add(c.id);
      for (const a of circleAncestors(c, byId)) keep.add(a.id);
    }
  }
  return circles.filter((c) => keep.has(c.id));
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
