import { ORGS } from "@/lib/data";

/* Mock backing store — see the comment in members.js for why this is an
   independent copy rather than the array lib/data.js still exports. */
let _orgs = ORGS.map((o) => ({ ...o, offers: [...o.offers], members: [...o.members] }));

export async function getOrgs() {
  return _orgs;
}

export async function getOrgById(id) {
  return _orgs.find((o) => o.id === id) || null;
}

export async function getOrgsByMember(memberId) {
  return _orgs.filter((o) => o.members.includes(memberId));
}

export async function updateOrg(id, patch) {
  _orgs = _orgs.map((o) => (o.id === id ? { ...o, ...patch } : o));
  return _orgs.find((o) => o.id === id) || null;
}
