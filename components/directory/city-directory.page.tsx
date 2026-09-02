"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FolderGrid, PageContainer, PageHeader, SearchWithFilter } from "@/components/shared";
import { OrgCard } from "@/components/orgs/org-card";
import type { Org } from "@/lib/types";

interface CityDirectoryPageProps {
  orgs: Org[];
  onOpenOrg: (o: Org) => void;
}

interface Section {
  key: string;
  label: string;
  minWidth: number;
  items: Org[];
  renderItem: (o: Org) => ReactNode;
}

/* The federation-wide root of the Directory (rendered at /directory with no
   id) — shows every Neighborhood Council (each one the entry point into
   that neighborhood's own directory, see NeighborhoodDirectoryPage) and
   every federation-wide organization (no parent) as folders. No people grid
   here — nobody "lives" at the federation root, only within a
   neighborhood. */
export function CityDirectoryPage({ orgs, onOpenOrg }: CityDirectoryPageProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const directFolders = useMemo(() => orgs.filter((o) => !o.parentId), [orgs]);
  const folders = useMemo(() => {
    if (!searching) return directFolders;
    return orgs
      .filter((o) => [o.name, o.kind, o.tagline, ...(o.offers || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFolders, orgs, q]);

  const sections: Section[] = [
    {
      key: "councils", label: "Neighborhoods", minWidth: 300,
      items: folders.filter((o) => o.kind === "Council"),
      renderItem: (o: Org) => <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} showKindEyebrow={false} />,
    },
    {
      key: "orgs", label: "Organizations", minWidth: 300,
      items: folders.filter((o) => o.kind !== "Council"),
      renderItem: (o: Org) => <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} />,
    },
  ].filter((s) => s.items.length > 0);

  return (
    <PageContainer size="wide">
      {/* the top bar already shows "Directory" as the mobile section name
          (see top-bar.tsx), so this exact-duplicate title is redundant below
          that breakpoint — hidden there rather than removed, so it still
          shows at 720px+ where the top bar reverts to the brand link. */}
      <div className="hidden min-[720px]:block">
        <PageHeader title="Directory" />
      </div>

      {/* mt-5 only once there's something above it to space away from — at
          mobile, with PageHeader hidden, this is the top of the page, and
          PageContainer's own pt-6 already provides the right gap on its own. */}
      <SearchWithFilter
        className="min-[720px]:mt-5"
        query={query}
        onQuery={setQuery}
        placeholder="Search a name, kind, or what they offer"
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
    </PageContainer>
  );
}
