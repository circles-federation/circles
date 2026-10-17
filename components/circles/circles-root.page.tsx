"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, FolderGrid, PageContainer, PrivateLabel, SearchWithFilter } from "@/components/shared";
import { CircleCard } from "./circle-card";
import { CIRCLE_TYPE_LABEL, isGroup } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";

interface CirclesRootPageProps {
  circles: Circle[];
  onOpenCircle: (c: Circle) => void;
}

interface Section {
  key: string;
  label: ReactNode;
  minWidth: number;
  items: Circle[];
  renderItem: (c: Circle) => ReactNode;
}

/* The citywide root of the Circles browser (rendered at /circles with no id)
   — shows every circle directly under the city root: each neighborhood (the
   entry point into that neighborhood's own folder, see NeighborhoodPage) and
   every citywide circle (collectives, co-ops) as folders. No people grid
   here — nobody "lives" at the city root, only within a neighborhood. */
export function CirclesRootPage({ circles, onOpenCircle }: CirclesRootPageProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const root = circles.find((c) => c.parentId === null);
  const directFolders = useMemo(() => circles.filter((c) => root && c.parentId === root.id), [circles, root]);
  const folders = useMemo(() => {
    if (!searching) return directFolders;
    return circles
      .filter((c) => c.parentId !== null)
      .filter((c) => [c.name, CIRCLE_TYPE_LABEL[c.type], c.tagline, ...(c.offers || []), ...(c.needs || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFolders, circles, q]);

  const sections: Section[] = [
    {
      key: "neighborhoods", label: "Neighborhoods", minWidth: 300,
      items: folders.filter((c) => c.type === "neighborhood"),
      renderItem: (c: Circle) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showKindEyebrow={false} />,
    },
    // groups, which only their own members ever receive, in their own grid
    {
      key: "groups", label: <PrivateLabel>Groups</PrivateLabel>, minWidth: 300,
      items: folders.filter(isGroup),
      renderItem: (c: Circle) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showKindEyebrow={false} />,
    },
    {
      key: "circles", label: "Organizations", minWidth: 300,
      items: folders.filter((c) => c.type !== "neighborhood" && !isGroup(c)),
      renderItem: (c: Circle) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} />,
    },
  ].filter((s) => s.items.length > 0);

  return (
    <PageContainer size="wide">
      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder="Search a name, type, or what they offer"
        filters={[]}
      />

      {sections.length > 0 ? (
        <div className="mt-7 flex flex-col gap-7">
          {sections.map((s) => (
            <FolderGrid key={s.key} label={s.label} items={s.items} minWidth={s.minWidth} renderItem={s.renderItem} />
          ))}
        </div>
      ) : (
        <div className="mt-7">
          <EmptyState>{q ? `Nothing matches “${query.trim()}”.` : "No circles here yet. Start one with the + above."}</EmptyState>
        </div>
      )}
    </PageContainer>
  );
}
