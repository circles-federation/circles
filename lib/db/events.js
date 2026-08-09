import { EVENTS } from "@/lib/data";

/* Mock backing store — see the comment in members.js for why this is an
   independent copy rather than the array lib/data.js still exports. */
let _events = EVENTS.map((e) => ({ ...e, rsvps: [...e.rsvps], ...(e.votes ? { votes: [...e.votes] } : {}) }));
let _councilProposals = [];

export async function getEvents() {
  return _events;
}

export async function getEventById(id) {
  return _events.find((e) => e.id === id) || null;
}

export async function createEvent(event) {
  _events = [..._events, event];
  return event;
}

export async function updateEvent(id, patch) {
  _events = _events.map((e) => (e.id === id ? { ...e, ...patch } : e));
  return _events.find((e) => e.id === id) || null;
}

export async function getCouncilProposals() {
  return _councilProposals;
}

export async function createCouncilProposal(proposal) {
  _councilProposals = [..._councilProposals, proposal];
  return proposal;
}

export async function updateCouncilProposal(id, patch) {
  _councilProposals = _councilProposals.map((p) => (p.id === id ? { ...p, ...patch } : p));
  return _councilProposals.find((p) => p.id === id) || null;
}
