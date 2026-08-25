/* Pure helpers for the org hierarchy — orgs nest via `parentId` (another
   org's id, or null for root-level). Extend this module rather than
   duplicating tree-walking logic per component. */

// a Neighborhood Council (an org with `neighborhood` set) has no literal
// members array — every resident of that neighborhood is automatically a
// member, so its roster is always derived here, never stored on the org.
export function orgMembers(org, members) {
  if (org.neighborhood) {
    return members.filter((m) => m.neighborhood === org.neighborhood).map((m) => m.id);
  }
  return org.members || [];
}

// direct children only (one level down)
export function orgChildren(org, orgs) {
  return orgs.filter((o) => o.parentId === org.id);
}

// a Neighborhood Council displays as its bare neighborhood name ("The 903"),
// not its full org name ("The 903 Neighborhood Council") — used anywhere
// that name is shown as a title (org cards, Directory breadcrumbs/title).
export function orgDisplayName(org) {
  return org.neighborhood || org.name;
}

// walks parentId up to the nearest Neighborhood Council, i.e. the
// neighborhood an org effectively belongs to; null means federation-wide
// (no neighborhood ancestor) — replaces the old flat `level` field.
// orgsById is a lookup (id -> org), not the raw array.
export function orgScope(org, orgsById) {
  let current = org;
  while (current) {
    if (current.neighborhood) return current.neighborhood;
    current = current.parentId ? orgsById[current.parentId] : null;
  }
  return null;
}

// root-to-leaf chain of ancestors (not including org itself), for
// breadcrumbs. orgsById is a lookup (id -> org), not the raw array.
export function orgAncestors(org, orgsById) {
  const chain = [];
  let current = org.parentId ? orgsById[org.parentId] : null;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? orgsById[current.parentId] : null;
  }
  return chain;
}

// every org anywhere below org in the tree (not including org itself),
// for flattening a subtree search
export function orgDescendantIds(org, orgs) {
  const ids = [];
  const stack = orgChildren(org, orgs);
  while (stack.length) {
    const next = stack.pop();
    ids.push(next.id);
    stack.push(...orgChildren(next, orgs));
  }
  return ids;
}
