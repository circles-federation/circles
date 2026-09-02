import { ORGS } from "@/lib/data";
import type { Org } from "@/lib/types";

/* Mock backing store — see the comment in members.ts for why this is an
   independent copy rather than the array lib/data.ts still exports. */
let _orgs: Org[] = ORGS.map((o) => ({ ...o, offers: [...o.offers], members: [...o.members] }));

export async function getOrgs(): Promise<Org[]> {
  return _orgs;
}

export async function getOrgById(id: string): Promise<Org | null> {
  return _orgs.find((o) => o.id === id) || null;
}

export async function getOrgsByMember(memberId: number): Promise<Org[]> {
  return _orgs.filter((o) => o.members.includes(memberId));
}

export async function updateOrg(id: string, patch: Partial<Org>): Promise<Org | null> {
  _orgs = _orgs.map((o) => (o.id === id ? { ...o, ...patch } : o));
  return _orgs.find((o) => o.id === id) || null;
}
