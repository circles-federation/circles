"use client";

import { useMemo, useState } from "react";
import { Eyebrow, PageHeader, SearchWithFilter } from "@/components/shared";
import { OrgCard } from "@/components/orgs/org-card";
import { MemberCard } from "./member-card";
import { orgAncestors, orgChildren, orgDescendantIds, orgMembers } from "@/lib/orgs.util";
import { INK, SOFT, TYPE, sans } from "@/lib/theme";

/* The unified Directory — replaces the separate People and Organizations
   pages. Browsing is a folder hierarchy: orgs are folders (they nest via
   parentId, see lib/orgs.util.js), people are files (they never nest).
   Given an org id (or null for the true root — every root-level org, no
   file grid, since nobody "lives" at the federation root yet), this shows
   that org's direct children as folders and its own direct members as
   files. Search flattens the current org's whole subtree rather than just
   one level, per the user's explicit "start with flat search within the
   current folder's subtree" — global cross-subtree search is future work. */
export function BrowsePage({ org, orgs, members, profile, onOpenOrg, onOpenRoot, onOpenMember }) {
  const [query, setQuery] = useState("");
  const orgsById = useMemo(() => orgs.reduce((acc, o) => { acc[o.id] = o; return acc; }, {}), [orgs]);
  const membersById = useMemo(() => members.reduce((acc, m) => { acc[m.id] = m; return acc; }, {}), [members]);

  const breadcrumbs = org ? orgAncestors(org, orgsById) : [];
  const directFolders = org ? orgChildren(org, orgs) : orgs.filter((o) => !o.parentId);
  const directFiles = org ? orgMembers(org, members).map((id) => membersById[id]).filter(Boolean) : [];

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  // every org in the current subtree (including the current org itself),
  // or the whole tree at the true root — what search flattens across
  const subtreeOrgIds = useMemo(() => {
    if (!org) return new Set(orgs.map((o) => o.id));
    return new Set([org.id, ...orgDescendantIds(org, orgs)]);
  }, [org, orgs]);

  const folders = useMemo(() => {
    if (!searching) return directFolders;
    return orgs
      .filter((o) => subtreeOrgIds.has(o.id) && o.id !== org?.id)
      .filter((o) => [o.name, o.kind, o.tagline, ...(o.offers || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFolders, orgs, subtreeOrgIds, org, q]);

  const files = useMemo(() => {
    if (!searching) return directFiles;
    const ids = new Set();
    subtreeOrgIds.forEach((id) => orgMembers(orgsById[id], members).forEach((mid) => ids.add(mid)));
    return members
      .filter((m) => ids.has(m.id))
      .filter((m) => [m.name, m.role, ...(m.skills || []), ...(m.interests || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFiles, subtreeOrgIds, orgsById, members, q]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>
      {org && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            onClick={onOpenRoot}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-eyebrow font-bold tracking-[0.08em] text-soft uppercase hover:text-ink"
          >
            Providence
          </button>
          {breadcrumbs.map((b) => (
            <span key={b.id} className="flex items-center gap-1.5">
              <span style={{ color: SOFT }}>/</span>
              <button
                onClick={() => onOpenOrg(b)}
                className="cursor-pointer border-none bg-transparent p-0 font-sans text-eyebrow font-bold tracking-[0.08em] text-soft uppercase hover:text-ink"
              >
                {b.name}
              </button>
            </span>
          ))}
          <span style={{ color: SOFT }}>/</span>
          <span className="font-sans text-eyebrow font-bold tracking-[0.08em] text-ink uppercase">{org.name}</span>
        </div>
      )}

      <PageHeader title={org ? org.name : "Directory"}>
        <span style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xs, letterSpacing: "0.08em" }}>{folders.length + files.length} shown</span>
      </PageHeader>

      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder={org ? `Search within ${org.name}` : "Search a name, kind, or what they offer"}
        filters={[]}
      />

      {folders.length > 0 && (
        <section className="pt-7">
          <Eyebrow style={{ color: SOFT }}>Organizations</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 0, marginTop: 14, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
            {folders.map((o) => (
              <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} />
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="pt-7">
          <Eyebrow style={{ color: SOFT }}>People</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 0, marginTop: 14, borderTop: `1px solid ${INK}`, borderLeft: `1px solid ${INK}` }}>
            {files.map((m) => (
              <MemberCard key={m.id} m={m} profile={profile} onOpenMember={onOpenMember} />
            ))}
          </div>
        </section>
      )}

      {folders.length === 0 && files.length === 0 && (
        <p className="mt-7 font-serif text-sm text-soft">Nothing here yet.</p>
      )}
    </div>
  );
}
