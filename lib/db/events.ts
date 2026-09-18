import { eq, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  councilProposalRatifyVotes,
  councilProposals,
  eventRsvps,
  eventVotes,
  events,
  roleMembers,
  roles,
} from "./schema";
import { groupBy } from "./util";
import type { CouncilProposal, Event, Host, Role } from "@/lib/types";

type EventRow = typeof events.$inferSelect;
type ProposalRow = typeof councilProposals.$inferSelect;

function toHost(row: EventRow): Host {
  // the event_host_exactly_one check constraint guarantees hostMemberId is
  // set whenever hostOrgId isn't, and vice versa
  if (row.hostOrgId) return { type: "org", id: row.hostOrgId };
  return { type: "member", id: row.hostMemberId! };
}

function fromHost(host: Host): { hostMemberId: number | null; hostOrgId: string | null } {
  return host.type === "member" ? { hostMemberId: host.id, hostOrgId: null } : { hostMemberId: null, hostOrgId: host.id };
}

// Postgres always formats a `time` column as "HH:MM:SS" on read, regardless
// of input precision — lib/format.util.ts's fmtTime/eventDateTime assume the
// app's own "HH:MM" shape, so every read normalizes it back to that
function toClockTime(t: string): string {
  return t.slice(0, 5);
}

function toEvent(row: EventRow, rsvps: number[], votes: number[] | undefined, eventRoles: Role[] | undefined): Event {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? undefined,
    host: toHost(row),
    date: row.date,
    start: toClockTime(row.start),
    end: toClockTime(row.end),
    location: row.location,
    description: row.description,
    rsvps,
    membersOnly: row.membersOnly ?? undefined,
    roles: eventRoles,
    orgId: row.orgId ?? undefined,
    votes,
    scope: row.scope ?? undefined,
    sponsor:
      row.sponsorId && row.sponsorName && row.sponsorNeighborhood
        ? { id: row.sponsorId, name: row.sponsorName, neighborhood: row.sponsorNeighborhood }
        : undefined,
    endorsements: row.endorsements ?? undefined,
    endorsesCouncilId: row.endorsesCouncilId ?? undefined,
  };
}

// governance-only: only meeting/council events ever carry a votes array —
// ordinary events leave it undefined rather than an empty array
function isGovernanceKind(kind: EventRow["kind"]): boolean {
  return kind === "meeting" || kind === "council";
}

async function attachRelations(rows: EventRow[]): Promise<Event[]> {
  if (rows.length === 0) return [];
  const [rsvpRows, voteRows, roleRows, roleMemberRows] = await Promise.all([
    db.select().from(eventRsvps),
    db.select().from(eventVotes),
    db.select().from(roles),
    db.select().from(roleMembers),
  ]);
  const rsvpsByEvent = groupBy(rsvpRows, (r) => r.eventId, (r) => r.memberId);
  const votesByEvent = groupBy(voteRows, (r) => r.eventId, (r) => r.memberId);
  const membersByRole = groupBy(roleMemberRows, (r) => r.roleId, (r) => r.memberId);
  const rolesByEvent = new Map<string, Role[]>();
  for (const r of roleRows) {
    const role: Role = {
      key: r.key,
      label: r.label,
      description: r.description ?? undefined,
      min: r.min,
      members: membersByRole.get(r.id) || [],
      ...(r.max != null ? { max: r.max } : {}),
    };
    const list = rolesByEvent.get(r.eventId);
    if (list) list.push(role);
    else rolesByEvent.set(r.eventId, [role]);
  }
  return rows.map((row) =>
    toEvent(
      row,
      rsvpsByEvent.get(row.id) || [],
      isGovernanceKind(row.kind) ? votesByEvent.get(row.id) || [] : undefined,
      rolesByEvent.get(row.id)
    )
  );
}

export async function getEvents(): Promise<Event[]> {
  const rows = await db.select().from(events);
  return attachRelations(rows);
}

export async function getEventById(id: string): Promise<Event | null> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row) return null;
  const [full] = await attachRelations([row]);
  return full ?? null;
}

async function writeRoles(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], eventId: string, eventRoles: Role[]) {
  const existing = await tx.select({ id: roles.id }).from(roles).where(eq(roles.eventId, eventId));
  if (existing.length > 0) {
    await tx.delete(roleMembers).where(inArray(roleMembers.roleId, existing.map((r) => r.id)));
    await tx.delete(roles).where(eq(roles.eventId, eventId));
  }
  for (const role of eventRoles) {
    const [roleRow] = await tx
      .insert(roles)
      .values({ eventId, key: role.key, label: role.label, description: role.description ?? null, min: role.min, max: role.max ?? null })
      .returning();
    if (role.members.length > 0 && roleRow) {
      await tx.insert(roleMembers).values(role.members.map((memberId) => ({ roleId: roleRow.id, memberId })));
    }
  }
}

export async function createEvent(event: Event): Promise<Event> {
  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      id: event.id,
      title: event.title,
      kind: event.kind ?? null,
      ...fromHost(event.host),
      date: event.date,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
      membersOnly: event.membersOnly ?? null,
      orgId: event.orgId ?? null,
      scope: event.scope ?? null,
      sponsorId: event.sponsor?.id ?? null,
      sponsorName: event.sponsor?.name ?? null,
      sponsorNeighborhood: event.sponsor?.neighborhood ?? null,
      endorsements: event.endorsements ?? null,
      endorsesCouncilId: event.endorsesCouncilId ?? null,
    });
    if (event.rsvps.length > 0) {
      await tx.insert(eventRsvps).values(event.rsvps.map((memberId) => ({ eventId: event.id, memberId })));
    }
    if (event.votes && event.votes.length > 0) {
      await tx.insert(eventVotes).values(event.votes.map((memberId) => ({ eventId: event.id, memberId })));
    }
    if (event.roles && event.roles.length > 0) {
      await writeRoles(tx, event.id, event.roles);
    }
  });
  return event;
}

export async function updateEvent(id: string, patch: Partial<Event>): Promise<Event | null> {
  await db.transaction(async (tx) => {
    const columnPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) columnPatch.title = patch.title;
    if (patch.kind !== undefined) columnPatch.kind = patch.kind;
    if (patch.host !== undefined) Object.assign(columnPatch, fromHost(patch.host));
    if (patch.date !== undefined) columnPatch.date = patch.date;
    if (patch.start !== undefined) columnPatch.start = patch.start;
    if (patch.end !== undefined) columnPatch.end = patch.end;
    if (patch.location !== undefined) columnPatch.location = patch.location;
    if (patch.description !== undefined) columnPatch.description = patch.description;
    if (patch.membersOnly !== undefined) columnPatch.membersOnly = patch.membersOnly;
    if (patch.orgId !== undefined) columnPatch.orgId = patch.orgId ?? null;
    if (patch.scope !== undefined) columnPatch.scope = patch.scope ?? null;
    if (patch.sponsor !== undefined) {
      columnPatch.sponsorId = patch.sponsor?.id ?? null;
      columnPatch.sponsorName = patch.sponsor?.name ?? null;
      columnPatch.sponsorNeighborhood = patch.sponsor?.neighborhood ?? null;
    }
    if (patch.endorsements !== undefined) columnPatch.endorsements = patch.endorsements;
    if (patch.endorsesCouncilId !== undefined) columnPatch.endorsesCouncilId = patch.endorsesCouncilId ?? null;

    if (Object.keys(columnPatch).length > 0) {
      await tx.update(events).set(columnPatch).where(eq(events.id, id));
    }
    if (patch.rsvps !== undefined) {
      await tx.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
      if (patch.rsvps.length > 0) await tx.insert(eventRsvps).values(patch.rsvps.map((memberId) => ({ eventId: id, memberId })));
    }
    if (patch.votes !== undefined) {
      await tx.delete(eventVotes).where(eq(eventVotes.eventId, id));
      if (patch.votes.length > 0) await tx.insert(eventVotes).values(patch.votes.map((memberId) => ({ eventId: id, memberId })));
    }
    if (patch.roles !== undefined) {
      await writeRoles(tx, id, patch.roles);
    }
  });
  return getEventById(id);
}

async function attachRatifyVotes(rows: ProposalRow[]): Promise<CouncilProposal[]> {
  if (rows.length === 0) return [];
  const voteRows = await db.select().from(councilProposalRatifyVotes);
  const votesByProposal = groupBy(voteRows, (r) => r.proposalId, (r) => r.memberId);
  return rows.map((row) => ({
    id: row.id,
    assemblyId: row.assemblyId,
    sponsorHood: row.sponsorHood,
    sponsorName: row.sponsorName,
    proposedBy: row.proposedBy,
    title: row.title,
    date: row.date,
    start: toClockTime(row.start),
    end: toClockTime(row.end),
    location: row.location,
    agenda: row.agenda,
    ratifyVotes: votesByProposal.get(row.id) || [],
    ratified: row.ratified,
    councilId: row.councilId,
  }));
}

export async function getCouncilProposals(): Promise<CouncilProposal[]> {
  const rows = await db.select().from(councilProposals);
  return attachRatifyVotes(rows);
}

export async function createCouncilProposal(proposal: CouncilProposal): Promise<CouncilProposal> {
  await db.transaction(async (tx) => {
    await tx.insert(councilProposals).values({
      id: proposal.id,
      assemblyId: proposal.assemblyId,
      sponsorHood: proposal.sponsorHood,
      sponsorName: proposal.sponsorName,
      proposedBy: proposal.proposedBy,
      title: proposal.title,
      date: proposal.date,
      start: proposal.start,
      end: proposal.end,
      location: proposal.location,
      agenda: proposal.agenda,
      ratified: proposal.ratified,
      councilId: proposal.councilId,
    });
    if (proposal.ratifyVotes.length > 0) {
      await tx.insert(councilProposalRatifyVotes).values(proposal.ratifyVotes.map((memberId) => ({ proposalId: proposal.id, memberId })));
    }
  });
  return proposal;
}

export async function updateCouncilProposal(id: string, patch: Partial<CouncilProposal>): Promise<CouncilProposal | null> {
  await db.transaction(async (tx) => {
    const columnPatch: Record<string, unknown> = {};
    if (patch.ratified !== undefined) columnPatch.ratified = patch.ratified;
    if (patch.councilId !== undefined) columnPatch.councilId = patch.councilId;
    if (Object.keys(columnPatch).length > 0) {
      await tx.update(councilProposals).set(columnPatch).where(eq(councilProposals.id, id));
    }
    if (patch.ratifyVotes !== undefined) {
      await tx.delete(councilProposalRatifyVotes).where(eq(councilProposalRatifyVotes.proposalId, id));
      if (patch.ratifyVotes.length > 0) {
        await tx.insert(councilProposalRatifyVotes).values(patch.ratifyVotes.map((memberId) => ({ proposalId: id, memberId })));
      }
    }
  });
  const [row] = await db.select().from(councilProposals).where(eq(councilProposals.id, id));
  if (!row) return null;
  const [full] = await attachRatifyVotes([row]);
  return full ?? null;
}
