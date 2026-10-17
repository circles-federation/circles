"use client";

import { useMemo, useState } from "react";
import { EmptyState, FolderGrid, PageContainer, PrivateLabel, SearchWithFilter } from "@/components/shared";
import { CircleCard } from "./circle-card";
import { MemberCard } from "./member-card";
import { ParentCircle } from "./parent-circle";
import { ProposalBanner } from "./proposal-banner";
import { useAppState } from "@/components/providers/app-state-provider";
import { circleChildren, circleDescendantIds, indexCircles, isGroup } from "@/lib/circles.util";
import type { Circle, Member, Profile } from "@/lib/types";

const ENTITY_TYPES = ["Circles", "Groups", "Organizations", "People"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

interface NeighborhoodPageProps {
  circle: Circle;
  circles: Circle[];
  members: Member[];
  profile: Profile;
  onOpenCircle: (c: Circle) => void;
  onOpenMember: (m: Member) => void;
  // seeds the Type filter — e.g. Home's "Neighbors"/"Local circles" stat
  // cards land here pre-filtered rather than on the unfiltered folder view.
  // Invalid/unrecognized values (a hand-edited URL, say) are dropped rather
  // than surfaced as an error, same as an unmatched search query just shows
  // "Nothing here yet."
  initialTypeFilter?: string[];
}

/* A single neighborhood's own folder (rendered at /circles/[id] for a
   circle of type "neighborhood" — see app/(app)/circles/[id]/page.tsx, which
   renders every other circle as its own detail page, CirclePage, at that same
   route instead). Shows the neighborhood's own circles
   (Finance/Grounds/Community councils, for The 903) and organizations as folders, and
   its residents (its explicit members) as files. Search flattens the whole
   subtree rather than just one level.

   Every card here shares this page's own neighborhood (the one being
   browsed), so CircleCard/MemberCard's neighborhood chips remain off throughout —
   unlike CirclesRootPage, where cards span multiple neighborhoods and the
   chip is what tells them apart. */
export function NeighborhoodPage({ circle, circles, members, profile, onOpenCircle, onOpenMember, initialTypeFilter }: NeighborhoodPageProps) {
  // only a circle's members are ever sent its proposals
  const { proposals } = useAppState();
  const openProposals = proposals.filter((p) => p.circleId === circle.id && p.status === "open");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType[]>(() => (initialTypeFilter || []).filter(isEntityType));
  const circlesById = useMemo(() => indexCircles(circles), [circles]);
  const membersById = useMemo(() => members.reduce<Record<number, Member>>((acc, m) => { acc[m.id] = m; return acc; }, {}), [members]);

  const directFolders = circleChildren(circle, circles);
  const directFiles = circle.members.map((id) => membersById[id]).filter((m): m is Member => Boolean(m));

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const subtreeCircleIds = useMemo(() => new Set([circle.id, ...circleDescendantIds(circle, circles)]), [circle, circles]);

  const folders = useMemo(() => {
    if (!searching) return directFolders;
    return circles
      .filter((c) => subtreeCircleIds.has(c.id) && c.id !== circle.id)
      .filter((c) => [c.name, c.type, c.tagline, ...(c.offers || []), ...(c.needs || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFolders, circles, subtreeCircleIds, circle, q]);

  const files = useMemo(() => {
    if (!searching) return directFiles;
    const ids = new Set<number>();
    subtreeCircleIds.forEach((id) => {
      const c = circlesById[id];
      if (c) c.members.forEach((mid) => ids.add(mid));
    });
    return members
      .filter((m) => ids.has(m.id))
      .filter((m) => [m.name, m.role, ...(m.skills || []), ...(m.interests || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searching, directFiles, subtreeCircleIds, circlesById, members, q]);

  // no types selected means no filter applied (show everything) — folders/
  // files above still do the query narrowing, this just decides which of
  // the three grids below are eligible to render at all. Any combination of
  // types can be selected at once (e.g. Circles + Organizations, no People).
  const showCircles = typeFilter.length === 0 || typeFilter.includes("Circles");
  const showGroups = typeFilter.length === 0 || typeFilter.includes("Groups");
  const showOrgs = typeFilter.length === 0 || typeFilter.includes("Organizations");
  const showPeople = typeFilter.length === 0 || typeFilter.includes("People");

  // groups get their own grid, between the circles and the organizations
  // (only a group's members ever receive it, so only they see it here)
  const circleFolders = showCircles ? folders.filter((c) => c.type === "circle") : [];
  const groupFolders = showGroups ? folders.filter(isGroup) : [];
  const otherFolders = showOrgs ? folders.filter((c) => c.type !== "circle" && !isGroup(c)) : [];
  const peopleFiles = showPeople ? files : [];
  const anySections = circleFolders.length > 0 || groupFolders.length > 0 || otherFolders.length > 0 || peopleFiles.length > 0;

  return (
    <PageContainer size="wide">
      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder={`Search within ${circle.name}`}
        filters={[
          { label: "Type", options: [...ENTITY_TYPES], multi: true, active: typeFilter, onFilter: (v) => setTypeFilter(v as EntityType[]) },
        ]}
      />

      <div className="mt-7 flex flex-col gap-7">
        {/* not something search or the Type filter can match, so it steps
            aside while either is narrowing the view */}
        {/* its open proposals (a meeting it's deciding, say), for its members:
            like the Part of card, not something search or the filter matches */}
        {!searching && typeFilter.length === 0 && openProposals.length > 0 && (
          <div className="flex flex-col gap-3">
            {openProposals.map((p) => <ProposalBanner key={p.id} proposal={p} memberId={profile.id} />)}
          </div>
        )}
        {!searching && typeFilter.length === 0 && <ParentCircle circle={circle} onOpenCircle={onOpenCircle} />}
        {anySections ? (
          <>
            {circleFolders.length > 0 && (
              <FolderGrid
                label="Circles"
                items={circleFolders}
                minWidth={300}
                renderItem={(c) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} showKindEyebrow={false} />}
              />
            )}
            {groupFolders.length > 0 && (
              <FolderGrid
                label={<PrivateLabel>Groups</PrivateLabel>}
                items={groupFolders}
                minWidth={300}
                renderItem={(c) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} showKindEyebrow={false} />}
              />
            )}
            {otherFolders.length > 0 && (
              <FolderGrid
                label="Organizations"
                items={otherFolders}
                minWidth={300}
                renderItem={(c) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} />}
              />
            )}
            {peopleFiles.length > 0 && (
              <FolderGrid
                label="People"
                items={peopleFiles}
                minWidth={230}
                renderItem={(m) => <MemberCard key={m.id} m={m} profile={profile} onOpenMember={onOpenMember} showNeighborhoodChip={false} />}
              />
            )}
          </>
        ) : (
          <EmptyState>{searching || typeFilter.length > 0 ? "Nothing matches your search or filter." : "No circles or neighbors here yet."}</EmptyState>
        )}
      </div>
    </PageContainer>
  );
}
