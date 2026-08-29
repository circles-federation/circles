"use client";

import { useMemo, useState } from "react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Eyebrow, PageHeader, SearchWithFilter } from "@/components/shared";
import { OrgCard } from "@/components/orgs/org-card";
import { MemberCard } from "./member-card";
import {
  orgAncestors,
  orgChildren,
  orgDescendantIds,
  orgDisplayName,
  orgMembers,
  orgScope,
} from "@/lib/orgs.util";

/* The unified Directory — replaces the separate People and Organizations
   pages. Browsing is a folder hierarchy: orgs are folders (they nest via
   parentId, see lib/orgs.util.js), people are files (they never nest).
   Given an org id (or null for the true root — every root-level org, no
   file grid, since nobody "lives" at the federation root yet), this shows
   that org's direct children as folders and its own direct members as
   files. Search flattens the current org's whole subtree rather than just
   one level, per the user's explicit "start with flat search within the
   current folder's subtree" — global cross-subtree search is future work.

   Root vs. org-folder differences (title, the councils-grid label, the
   search placeholder) are resolved once into `view` below, rather than as
   ternaries repeated through the JSX. The grids to show are a `sections`
   list (already filtered to non-empty), stacked via one flex/gap wrapper
   rather than each <FolderGrid> padding itself for spacing, and the
   breadcrumb bar is its own <Breadcrumbs> — both local to this file since
   they're not (yet) needed anywhere else. */
export function BrowsePage({
  org,
  orgs,
  members,
  profile,
  onOpenOrg,
  onOpenRoot,
  onOpenMember,
}) {
  const [query, setQuery] = useState("");
  const orgsById = useMemo(
    () =>
      orgs.reduce((acc, o) => {
        acc[o.id] = o;
        return acc;
      }, {}),
    [orgs],
  );
  const membersById = useMemo(
    () =>
      members.reduce((acc, m) => {
        acc[m.id] = m;
        return acc;
      }, {}),
    [members],
  );

  const isRoot = !org;
  const breadcrumbTrail = isRoot ? [] : orgAncestors(org, orgsById);
  const directFolders = isRoot
    ? orgs.filter((o) => !o.parentId)
    : orgChildren(org, orgs);
  const directFiles = isRoot
    ? []
    : orgMembers(org, members)
        .map((id) => membersById[id])
        .filter(Boolean);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  // every org in the current subtree (including the current org itself),
  // or the whole tree at the true root — what search flattens across
  const subtreeOrgIds = useMemo(() => {
    if (isRoot) return new Set(orgs.map((o) => o.id));
    return new Set([org.id, ...orgDescendantIds(org, orgs)]);
  }, [isRoot, org, orgs]);

  const folders = useMemo(() => {
    if (!searching) return directFolders;
    return orgs
      .filter((o) => subtreeOrgIds.has(o.id) && o.id !== org?.id)
      .filter((o) =>
        [o.name, o.kind, o.tagline, ...(o.offers || [])]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFolders, orgs, subtreeOrgIds, org, q]);
  const councilFolders = folders.filter((o) => o.kind === "Council");
  const orgFolders = folders.filter((o) => o.kind !== "Council");

  const files = useMemo(() => {
    if (!searching) return directFiles;
    const ids = new Set();
    subtreeOrgIds.forEach((id) =>
      orgMembers(orgsById[id], members).forEach((mid) => ids.add(mid)),
    );
    return members
      .filter((m) => ids.has(m.id))
      .filter((m) =>
        [m.name, m.role, ...(m.skills || []), ...(m.interests || [])]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFiles, subtreeOrgIds, orgsById, members, q]);

  // every card inside a folder shares that folder's own scope (orgScope
  // always resolves a whole subtree to the same ancestor), so the scope chip
  // only earns its place at the true root, where scope actually varies
  // between cards — inside a folder it's redundant with the page title below.
  const isHomeScope =
    !isRoot && orgScope(org, orgsById) === profile.neighborhood;

  const view = {
    title: isRoot ? "Directory" : orgDisplayName(org),
    councilsLabel: isRoot ? "Neighborhoods" : "Councils",
    searchPlaceholder: isRoot
      ? "Search a name, kind, or what they offer"
      : `Search within ${orgDisplayName(org)}`,
  };

  const sections = [
    {
      key: "councils",
      label: view.councilsLabel,
      items: councilFolders,
      minWidth: 300,
      renderItem: (o) => (
        <OrgCard
          key={o.id}
          o={o}
          onOpenOrg={onOpenOrg}
          showScopeChip={isRoot}
          showKindEyebrow={false}
        />
      ),
    },
    {
      key: "orgs",
      label: "Organizations",
      items: orgFolders,
      minWidth: 300,
      renderItem: (o) => (
        <OrgCard
          key={o.id}
          o={o}
          onOpenOrg={onOpenOrg}
          showScopeChip={isRoot}
        />
      ),
    },
    {
      key: "people",
      label: "People",
      items: files,
      minWidth: 230,
      renderItem: (m) => (
        <MemberCard
          key={m.id}
          m={m}
          profile={profile}
          onOpenMember={onOpenMember}
          showScopeChip={isRoot}
        />
      ),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-270 px-6 pt-10 pb-20">
      <Breadcrumbs
        trail={breadcrumbTrail}
        current={org}
        onOpenRoot={onOpenRoot}
        onOpenOrg={onOpenOrg}
      />

      <PageHeader
        title={
          isHomeScope ? (
            <span className="inline-flex items-center gap-2">
              {view.title}
              <HomeIcon className="size-6 shrink-0 text-teal" strokeWidth={2} />
            </span>
          ) : (
            view.title
          )
        }
      />

      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder={view.searchPlaceholder}
        filters={[]}
      />

      {sections.length > 0 ? (
        <div className="mt-7 flex flex-col gap-7">
          {sections.map((s) => (
            <FolderGrid
              key={s.key}
              label={s.label}
              items={s.items}
              minWidth={s.minWidth}
              renderItem={s.renderItem}
            />
          ))}
        </div>
      ) : (
        <p className="mt-7 font-serif text-sm text-soft">Nothing here yet.</p>
      )}
    </div>
  );
}

function Breadcrumbs({ trail, current, onOpenRoot, onOpenOrg }) {
  if (!current) return null;
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
      <span className="font-sans text-eyebrow font-bold tracking-[0.08em] text-ink uppercase">
        {orgDisplayName(current)}
      </span>
    </div>
  );
}

function FolderGrid({ label, items, minWidth, renderItem }) {
  return (
    <section>
      <Eyebrow className="text-soft">{label}</Eyebrow>
      <div
        className="mt-3.5 grid border-t border-l border-ink"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}px), 1fr))`,
        }}
      >
        {items.map(renderItem)}
      </div>
    </section>
  );
}
