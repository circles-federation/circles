import { MEMBERS } from "@/lib/data";

/* Mock backing store — a private, independent copy of the seed data. Not the
   same array `lib/data.js` still exports, so writes here don't reach the
   components that (for now) still import MEMBERS directly. A real backend
   swap replaces everything below the seeding line; call sites never change. */
let _members = MEMBERS.map((m) => ({ ...m }));

export async function getMembers() {
  return _members;
}

export async function getMemberById(id) {
  return _members.find((m) => m.id === id) || null;
}

export async function getMemberByEmail(email) {
  const normalized = email.trim().toLowerCase();
  return _members.find((m) => m.email && m.email.toLowerCase() === normalized) || null;
}

export async function updateMember(id, patch) {
  _members = _members.map((m) => (m.id === id ? { ...m, ...patch } : m));
  return _members.find((m) => m.id === id) || null;
}
