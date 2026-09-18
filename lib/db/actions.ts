"use server";

import * as events from "./events";
import * as members from "./members";
import * as orgs from "./orgs";
import type { CouncilProposal, Event, Member, Org } from "@/lib/types";

/* AppStateProvider is a Client Component and can't hold a real DB
   connection — Drizzle's Postgres driver is Node-only. These thin wrappers
   are the boundary it calls through instead, the same "use server" pattern
   lib/auth.ts already uses. Reads don't need this: app/(app)/layout.tsx is
   already a Server Component and imports lib/db/*.ts directly. */

export async function updateMemberAction(id: number, patch: Partial<Member>) {
  return members.updateMember(id, patch);
}

export async function updateOrgAction(id: string, patch: Partial<Org>) {
  return orgs.updateOrg(id, patch);
}

export async function createEventAction(ev: Event) {
  return events.createEvent(ev);
}

export async function updateEventAction(id: string, patch: Partial<Event>) {
  return events.updateEvent(id, patch);
}

export async function createCouncilProposalAction(p: CouncilProposal) {
  return events.createCouncilProposal(p);
}

export async function updateCouncilProposalAction(id: string, patch: Partial<CouncilProposal>) {
  return events.updateCouncilProposal(id, patch);
}
