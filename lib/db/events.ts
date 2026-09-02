import { EVENTS } from "@/lib/data";
import type { CouncilProposal, Event } from "@/lib/types";

/* Mock backing store — see the comment in members.ts for why this is an
   independent copy rather than the array lib/data.ts still exports. */
let _events: Event[] = EVENTS.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) }));
let _councilProposals: CouncilProposal[] = [];

export async function getEvents(): Promise<Event[]> {
  return _events;
}

export async function getEventById(id: string): Promise<Event | null> {
  return _events.find((e) => e.id === id) || null;
}

export async function createEvent(event: Event): Promise<Event> {
  _events = [..._events, event];
  return event;
}

export async function updateEvent(id: string, patch: Partial<Event>): Promise<Event | null> {
  _events = _events.map((e) => (e.id === id ? { ...e, ...patch } : e));
  return _events.find((e) => e.id === id) || null;
}

export async function getCouncilProposals(): Promise<CouncilProposal[]> {
  return _councilProposals;
}

export async function createCouncilProposal(proposal: CouncilProposal): Promise<CouncilProposal> {
  _councilProposals = [..._councilProposals, proposal];
  return proposal;
}

export async function updateCouncilProposal(id: string, patch: Partial<CouncilProposal>): Promise<CouncilProposal | null> {
  _councilProposals = _councilProposals.map((p) => (p.id === id ? { ...p, ...patch } : p));
  return _councilProposals.find((p) => p.id === id) || null;
}
