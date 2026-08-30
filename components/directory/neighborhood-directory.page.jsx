"use client";

import { useMemo, useState } from "react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { FolderGrid, PageHeader, SearchWithFilter } from "@/components/shared";
import { OrgCard } from "@/components/orgs/org-card";
import { MemberCard } from "./member-card";
import { orgAncestors, orgChildren, orgDescendantIds, orgDisplayName, orgMembers } from "@/lib/orgs.util";

/* A single neighborhood's own directory (rendered at /directory/[id], where
   org is always that neighborhood's Neighborhood Council — see
   app/(app)/directory/[id]/page.jsx, which renders every other org as its
   own detail page, OrgPage, at that same route instead). Shows the
   Council's own sub-councils
   (Finance/Grounds/Community, for The 903) and organizations as folders,
   and its residents (its derived membership, see orgMembers in
   lib/orgs.util.js) as files. Search flattens the Council's whole subtree
   rather than just one level.

   Every card here shares this page's own scope (the Council being browsed),
   so OrgCard/MemberCard's scope chips remain off throughout — unlike
   CityDirectoryPage, where cards span multiple neighborhoods and the chip
   is what tells them apart. */
export function NeighborhoodDirectoryPage({ org, orgs, members, profile, onOpenOrg, onOpenRoot, onOpenMember }) {
  const [query, setQuery] = useState("");
  const orgsById = useMemo(() => orgs.reduce((acc, o) => { acc[o.id] = o; return acc; }, {}), [orgs]);
  const membersById = useMemo(() => members.reduce((acc, m) => { acc[m.id] = m; return acc; }, {}), [members]);

  const directFolders = orgChildren(org, orgs);
  const directFiles = orgMembers(org, members).map((id) => membersById[id]).filter(Boolean);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const subtreeOrgIds = useMemo(() => new Set([org.id, ...orgDescendantIds(org, orgs)]), [org, orgs]);

  const folders = useMemo(() => {
    if (!searching) return directFolders;
    return orgs
      .filter((o) => subtreeOrgIds.has(o.id) && o.id !== org.id)
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

  const isHome = org.neighborhood === profile.neighborhood;

  const sections = [
    {
      key: "councils", label: "Councils", minWidth: 300,
      items: folders.filter((o) => o.kind === "Council"),
      renderItem: (o) => <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} showScopeChip={false} showKindEyebrow={false} />,
    },
    {
      key: "orgs", label: "Organizations", minWidth: 300,
      items: folders.filter((o) => o.kind !== "Council"),
      renderItem: (o) => <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} showScopeChip={false} />,
    },
    {
      key: "people", label: "People", minWidth: 230,
      items: files,
      renderItem: (m) => <MemberCard key={m.id} m={m} profile={profile} onOpenMember={onOpenMember} showScopeChip={false} />,
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-270 px-6 pt-10 pb-20">
      <Breadcrumbs trail={orgAncestors(org, orgsById)} current={org} onOpenRoot={onOpenRoot} onOpenOrg={onOpenOrg} />

      <PageHeader
        title={
          isHome ? (
            <span className="inline-flex items-center gap-2">
              {orgDisplayName(org)}
              <HomeIcon className="size-6 shrink-0 text-teal" strokeWidth={2} />
            </span>
          ) : (
            orgDisplayName(org)
          )
        }
      />

      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder={`Search within ${orgDisplayName(org)}`}
        filters={[]}
      />

      {sections.length > 0 ? (
        <div className="mt-7 flex flex-col gap-7">
          {sections.map((s) => (
            <FolderGrid key={s.key} label={s.label} items={s.items} minWidth={s.minWidth} renderItem={s.renderItem} />
          ))}
        </div>
      ) : (
        <p className="mt-7 font-serif text-sm text-soft">Nothing here yet.</p>
      )}
    </div>
  );
}

function Breadcrumbs({ trail, current, onOpenRoot, onOpenOrg }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        onClick={onOpenRoot}
        className="cursor-pointer border-none bg-transparent p-0 font-sans text-eyebrow font-bold tracking-[0.08em] text-soft uppercase hover:text-ink"
      >
        Providence
      </button>
      {trail.map((b) => (
        <span key={b.id} className="flex items-center gap-1.5">
          <span className="text-soft">/</span>
          <button
            onClick={() => onOpenOrg(b)}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-eyebrow font-bold tracking-[0.08em] text-soft uppercase hover:text-ink"
          >
            {orgDisplayName(b)}
          </button>
        </span>
      ))}
      <span className="text-soft">/</span>
      <span className="font-sans text-eyebrow font-bold tracking-[0.08em] text-ink uppercase">{orgDisplayName(current)}</span>
    </div>
  );
}
