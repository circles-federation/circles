import { MEMBERS } from "@/lib/data";
import type { Member } from "@/lib/types";

/* Mock backing store — a private, independent copy of the seed data. Not the
   same array `lib/data.ts` still exports, so writes here don't reach the
   components that (for now) still import MEMBERS directly. A real backend
   swap replaces everything below the seeding line; call sites never change. */
let _members: Member[] = MEMBERS.map((m) => ({ ...m }));

export async function getMembers(): Promise<Member[]> {
  return _members;
}

export async function getMemberById(id: number): Promise<Member | null> {
  return _members.find((m) => m.id === id) || null;
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const normalized = email.trim().toLowerCase();
  return _members.find((m) => m.email && m.email.toLowerCase() === normalized) || null;
}

export async function updateMember(id: number, patch: Partial<Member>): Promise<Member | null> {
  _members = _members.map((m) => (m.id === id ? { ...m, ...patch } : m));
  return _members.find((m) => m.id === id) || null;
}
