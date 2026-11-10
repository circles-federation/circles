import { and, eq, inArray, isNull, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import { UserFacingError } from "./errors";
import { circleInvitations, circleMembers, circleRoles, circles } from "./schema";
import { dropMembership } from "./memberships";
import { groupBy } from "./util";
import { assembleCircleRoles, circleHasRoles, DELEGATE, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { cleanAims, validateNewCircle, validateWikiPatch, type NewCircleInput, circleHasInbox, circleHasPage, circleHasPublicWiki } from "@/lib/circles.util";
import type { Circle, GroupFeature, PublicWiki } from "@/lib/types";

// the circles started inside another, when reading both at once
const subcircles = alias(circles, "subcircles");

type CircleRow = typeof circles.$inferSelect;

export class CircleError extends UserFacingError {}

function toCircle(row: CircleRow, memberIds: number[], savedRoles: CircleRoleDraft[]): Circle {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parentId,
    tagline: row.tagline,
    about: row.about,
    offers: row.offers,
    needs: row.needs,
    ...(row.domain ? { domain: row.domain } : {}),
    ...(row.inbox ? { inbox: true } : {}),
    ...(row.features.length > 0 ? { features: row.features } : {}),
    aims: row.aims,
    members: memberIds,
    ...(circleHasRoles(row) ? { roles: assembleCircleRoles(savedRoles, memberIds, row.type) } : {}),
    lastEditedBy: row.lastEditedBy ?? undefined,
    lastEditedAt: row.lastEditedAt ? row.lastEditedAt.toISOString() : undefined,
    facts: row.facts,
    join: row.join ?? undefined,
    contact: row.contact ?? undefined,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
    hours: row.hours ?? undefined,
  };
}

async function attachMembers(rows: CircleRow[]): Promise<Circle[]> {
  if (rows.length === 0) return [];
  const [memberRows, roleRows] = await Promise.all([
    db.select().from(circleMembers),
    db.select().from(circleRoles).orderBy(circleRoles.position),
  ]);
  const membersByCircle = groupBy(memberRows, (r) => r.circleId, (r) => r.memberId);
  const rolesByCircle = groupBy(roleRows, (r) => r.circleId, (r): CircleRoleDraft => ({ label: r.label, memberId: r.memberId }));
  return rows.map((row) => toCircle(row, membersByCircle.get(row.id) || [], rolesByCircle.get(row.id) || []));
}

/* Every circle this member may know of: all of them, except a group they
   don't belong to — a group is private to its members (see isGroup in
   lib/circles.util.ts), so it, and its roster, never reach anyone else's
   browser — and an archived one (its last member left), which reaches no
   one's. What AppState is seeded and refreshed with. */
export async function getCirclesForMember(memberId: number): Promise<Circle[]> {
  const rows = await db.select().from(circles).where(isNull(circles.archivedAt));
  const all = await attachMembers(rows);
  return all.filter((c) => c.type !== "group" || c.members.includes(memberId));
}

export async function getCircleById(id: string): Promise<Circle | null> {
  const [row] = await db.select().from(circles).where(eq(circles.id, id));
  if (!row) return null;
  const [full] = await attachMembers([row]);
  return full ?? null;
}

// a circle whose wiki anyone may read: one with a page and a wiki (not a
// neighborhood, the city or a group, which only its members know exists),
// and not archived
const hasPublicWiki = (c: { type: Circle["type"]; parentId: string | null; features: GroupFeature[]; archivedAt: Date | null }) => !c.archivedAt && circleHasPublicWiki(c);

/* A circle's wiki for anyone, signed in or not (its public page): the one
   place what a stranger sees of a circle is decided, so it reads only what
   the Wiki tab shows, never its members, roles or editors. Null for a circle
   with no public wiki. */
export async function getPublicWiki(id: string): Promise<PublicWiki | null> {
  const [row] = await db.select().from(circles).where(eq(circles.id, id));
  if (!row || !hasPublicWiki(row)) return null;
  const [parent] = row.parentId ? await db.select({ name: circles.name, parentId: circles.parentId }).from(circles).where(eq(circles.id, row.parentId)) : [];
  const children = (await db.select().from(circles).where(eq(circles.parentId, id))).filter(hasPublicWiki).sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    tagline: row.tagline,
    facts: row.facts,
    about: row.about,
    offers: row.offers,
    needs: row.needs,
    ...(row.website ? { website: row.website } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.contact ? { contact: row.contact } : {}),
    ...(row.hours && row.hours.length > 0 ? { hours: row.hours } : {}),
    ...(row.join ? { join: row.join } : {}),
    ...(parent ? { parent: { name: parent.name, isCity: parent.parentId === null } } : {}),
    subCircles: children.map((c) => ({ id: c.id, name: c.name, tagline: c.tagline })),
    inbox: circleHasInbox(row),
  };
}

export async function getCirclesByMember(memberId: number): Promise<Circle[]> {
  const memberships = await db.select({ circleId: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId));
  const ids = memberships.map((m) => m.circleId);
  if (ids.length === 0) return [];
  const rows = await db.select().from(circles).where(inArray(circles.id, ids));
  return attachMembers(rows);
}

/* Edit a circle's own page — member-gated, the same right `lib/db/circle-
   roles.ts`'s setCircleRoles already requires: `memberId` must belong to the
   circle being edited. Membership itself isn't editable through this generic
   patch — a client-supplied `members` key is silently dropped, same as
   `roles` — both have their own authorized write path (circle-roles.ts for
   roles; there is no membership-editing UI yet, so that door simply doesn't
   exist here). */
export async function updateCircle(memberId: number, id: string, patch: Partial<Circle>): Promise<Circle | null> {
  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) throw new CircleError("That circle doesn't exist.");
  const [membership] = await db.select().from(circleMembers).where(and(eq(circleMembers.circleId, id), eq(circleMembers.memberId, memberId))).limit(1);
  if (!membership) throw new CircleError(`Only members of ${circle.name} can edit its page.`);

  // becoming a group, or ceasing to be one, would hide a circle from everyone
  // outside it, or reveal a private one — a group's type is fixed
  if (patch.type !== undefined && patch.type !== circle.type && (patch.type === "group" || circle.type === "group")) {
    throw new CircleError("A group can't become another kind of circle, and a circle can't become a group.");
  }
  // Other is kept by a circle that's already Other, never chosen
  if (patch.type === "other" && circle.type !== "other") {
    throw new CircleError("Choose what kind of circle this is.");
  }
  // its name, tagline, type and parent are its members' to decide by
  // consent: a proposal makes them (lib/db/proposals.ts), never this edit
  const consentNeeded = (["name", "tagline", "type", "parentId"] as const).find((k) => patch[k] !== undefined && patch[k] !== circle[k]);
  if (consentNeeded) throw new CircleError("That change needs the circle's consent: propose it from Manage circle.");
  // what's left is the wiki, and only the wiki: nothing else a request carries
  // (archiving, the id, who last edited it) is taken from it
  const wiki = {
    ...(patch.about !== undefined ? { about: patch.about } : {}),
    ...(patch.offers !== undefined ? { offers: patch.offers } : {}),
    ...(patch.needs !== undefined ? { needs: patch.needs } : {}),
    ...(patch.facts !== undefined ? { facts: patch.facts } : {}),
    ...(patch.join !== undefined ? { join: patch.join } : {}),
    ...(patch.contact !== undefined ? { contact: patch.contact } : {}),
    ...(patch.website !== undefined ? { website: patch.website } : {}),
    ...(patch.address !== undefined ? { address: patch.address } : {}),
    ...(patch.hours !== undefined ? { hours: patch.hours } : {}),
  };
  const problem = validateWikiPatch(wiki);
  if (problem) throw new CircleError(problem);
  if (Object.keys(wiki).length > 0) {
    await db
      .update(circles)
      .set({ ...wiki, lastEditedBy: memberId, lastEditedAt: new Date() })
      .where(eq(circles.id, id));
  }
  return getCircleById(id);
}

// ids that are a route of their own under /circles, so can't name a circle
const RESERVED_IDS = new Set(["new"]);

// "Saturday Garden Crew!" → "saturday-garden-crew", the shape every circle's id
// (and so its URL) has
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "circle";
}

/* A new circle, created by `memberId` (Create circle), who becomes its first
   member — for a group, the only one who knows it exists until they invite
   someone. Validated with the form's own check (validateNewCircle), which
   also limits its parent to a neighborhood or the city. Its id is the name's
   slug, with -2, -3… added if that's taken (or reserved), and it starts
   with the creator as its last editor. The rest of its page (about, offers,
   facts…) is filled in from Manage circle. */
/* A Circle in a neighborhood is that neighborhood's to consent to (see
   neighborhoodFor in lib/proposals.util.ts), so it isn't created here: the
   caller (createCircleAction) proposes it instead, and it's made when that
   passes, by insertCircle. */
export async function createCircle(memberId: number, input: NewCircleInput): Promise<Circle> {
  const problem = validateNewCircle(input, await getCirclesForMember(memberId));
  if (problem) throw new CircleError(problem);
  const id = await db.transaction((tx) => insertCircle(tx, memberId, input));
  const created = await getCircleById(id);
  if (!created) throw new CircleError("The circle couldn't be created. Try again.");
  return created;
}

// the circle itself, already checked, with `memberId` as its first member and
// last editor; returns its id
export async function insertCircle(tx: Tx, memberId: number, input: NewCircleInput): Promise<string> {
  const base = slugify(input.name);
  const taken = new Set(
    (await tx.select({ id: circles.id }).from(circles).where(or(eq(circles.id, base), like(circles.id, `${base}-%`)))).map((r) => r.id)
  );
  let id = base;
  for (let n = 2; taken.has(id) || RESERVED_IDS.has(id); n++) id = `${base}-${n}`;
  await tx.insert(circles).values({
    id,
    type: input.type,
    name: input.name.trim(),
    parentId: input.parentId,
    tagline: input.tagline.trim(),
    about: "",
    ...(input.type === "circle" ? { domain: (input.domain ?? "").trim(), aims: cleanAims(input.aims) } : {}),
    lastEditedBy: memberId,
    lastEditedAt: new Date(),
  });
  await tx.insert(circleMembers).values({ circleId: id, circleType: input.type, memberId });
  return id;
}

/* `memberId` leaves a circle they belong to, deliberately (Manage circle).
   Any role they hold there is left empty, and any of its tasks they hold
   unassigned, rather than coming back if they rejoin. A neighborhood is their home and the city everyone's, so neither
   can be left this way. The last member out archives it: it's kept, but
   sent to no one any more (getCirclesForMember), and its pending invitations
   go, since there's no one left to welcome anyone in. Their proposals, and
   events they organize for it, stand. Locked on the circle, so two last
   members leaving at once can't both miss archiving it. */
export async function leaveCircle(memberId: number, circleId: string): Promise<{ archived: boolean }> {
  return db.transaction(async (tx) => {
    const [circle] = await tx.select().from(circles).where(and(eq(circles.id, circleId), isNull(circles.archivedAt))).for("update");
    if (!circle) throw new CircleError("That circle doesn't exist.");
    if (!circleHasPage(circle)) throw new CircleError("Your neighborhood and the city can't be left this way.");
    // a delegate sits here for their circle, so stays while they're its delegate
    const [delegating] = await tx
      .select({ name: subcircles.name })
      .from(circleRoles)
      .innerJoin(subcircles, eq(subcircles.id, circleRoles.circleId))
      .where(and(eq(subcircles.parentId, circleId), isNull(subcircles.archivedAt), eq(circleRoles.builtin, true), eq(circleRoles.label, DELEGATE), eq(circleRoles.memberId, memberId)));
    if (delegating) throw new CircleError(`You're ${delegating.name}'s delegate to ${circle.name}. ${delegating.name}'s members choose another delegate before you can leave.`);
    const [member] = await tx
      .select({ id: circleMembers.memberId })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId)));
    if (!member) throw new CircleError(`You're not a member of ${circle.name}.`);
    return dropMembership(tx, memberId, circleId);
  });
}
