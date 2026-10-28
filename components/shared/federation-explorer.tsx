"use client";

import { useMemo } from "react";
import { CheckIcon, ChevronRightIcon, HomeIcon, UserIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { circleAncestors, circlesByKind, indexCircles, type CirclesById } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";
import { CircleTypeIcon } from "./circle-type-icon";
import { EmptyState } from "./empty-state";
import { SearchWithFilter } from "./search-with-filter";

interface FederationExplorerProps {
  // the circles it shows, as the field using it decides (Parent circle: every
  // circle the member can see)
  circles: Circle[];
  // the one chosen, checked where it's listed
  value: string | null;
  // why a circle can't be chosen here, in a few words under it, or null when
  // it can. One that can't is still opened, to reach those inside it
  refusal: (circle: Circle) => string | null;
  // the circle it's in, and what's being searched for: held by
  // useFederationExplorer, whose Choose (in the top bar or the dialog's
  // header) chooses the circle it's in
  at: string;
  onOpen: (id: string) => void;
  query: string;
  onQuery: (query: string) => void;
  onChoose: (id: string) => void;
}

/* Choosing a circle from the whole federation the way a file is chosen from
   folders: one level at a time from the city down, with breadcrumbs back up.
   A circle with circles inside opens when tapped, and is chosen from inside,
   by the Choose its holder puts in the top bar or the dialog's header; one
   with none is chosen with a tap. What can't be chosen is grey, saying why,
   and opens all the same. A search flattens the tree, each result with its
   path. Opened through useFederationExplorer. */
export function FederationExplorer({ circles, value, refusal, at, onOpen, query, onQuery, onChoose }: FederationExplorerProps) {
  const byId = useMemo(() => indexCircles(circles), [circles]);
  const folder = byId[at];
  const childrenOf = (id: string) => circles.filter((c) => c.parentId === id);

  if (!folder) return <EmptyState>There are no circles to choose from.</EmptyState>;

  const q = query.trim().toLowerCase();
  const listed = q ? circles.filter((c) => c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)) : inKindOrder(childrenOf(folder.id));
  const folderRefusal = refusal(folder);

  return (
    <div className="flex flex-col gap-4">
      <SearchWithFilter query={query} onQuery={onQuery} placeholder="Search all circles" />

      {!q && (
        <div>
          {/* where it is: each circle above this one opens it, this one is the heading */}
          <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-1 gap-y-1 font-sans text-sm">
            {circleAncestors(folder, byId).map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onOpen(c.id)} className="hit relative cursor-pointer border-0 bg-transparent p-0 font-semibold text-soft underline underline-offset-2">
                  {c.name}
                </button>
                <ChevronRightIcon className="size-4 text-ghost" strokeWidth={2} aria-hidden />
              </span>
            ))}
            <span className="flex items-center gap-1 font-bold text-ink" aria-current="location">
              {folder.name}
              {folder.id === value && <CheckIcon className="size-4 shrink-0" strokeWidth={3} aria-label="Chosen" />}
            </span>
          </nav>
          {/* why Choose is off here */}
          {folderRefusal && <p className="mt-1 font-serif text-sm text-soft">{folderRefusal}</p>}
        </div>
      )}

      {listed.length > 0 ? (
        <ul className="m-0 list-none border-y border-faint p-0">
          {listed.map((c) => (
            <ExplorerRow
              key={c.id}
              circle={c}
              byId={byId}
              path={q ? circleAncestors(c, byId).map((a) => a.name).join(" › ") : null}
              opens={childrenOf(c.id).length > 0}
              chosen={c.id === value}
              refused={refusal(c)}
              onOpen={() => onOpen(c.id)}
              onChoose={() => onChoose(c.id)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState>{q ? `No circles match “${query.trim()}”.` : `There are no circles in ${folder.name}.`}</EmptyState>
      )}
    </div>
  );
}

interface ExplorerRowProps {
  circle: Circle;
  byId: CirclesById;
  // where it sits, for a search result
  path: string | null;
  // it has circles inside, so a tap opens it
  opens: boolean;
  chosen: boolean;
  refused: string | null;
  onOpen: () => void;
  onChoose: () => void;
}

// a circle in the list: its icon, its name (marked, like the home on your
// neighborhood, with a person on a circle you're a member of), why it can't be chosen, and a chevron if it opens
function ExplorerRow({ circle: c, path, opens, chosen, refused, onOpen, onChoose }: ExplorerRowProps) {
  const { profile } = useAppState();
  const home = c.id === profile.homeCircleId;
  const member = !home && c.members.includes(profile.id);
  const act = opens ? onOpen : refused ? null : onChoose;

  const body = (
    <>
      <CircleTypeIcon circle={c} className={clsx("size-5 shrink-0", refused ? "text-ghost" : "text-ink")} strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={clsx("font-sans text-base font-semibold", refused ? "text-soft" : "text-ink")}>{c.name}</span>
          {home && <HomeIcon className="size-4 shrink-0 text-teal" strokeWidth={2.5} aria-label="Your neighborhood" />}
          {member && <UserIcon className="size-4 shrink-0 text-teal" strokeWidth={2.5} aria-label="You're a member" />}
        </span>
        {path && <span className="block truncate font-sans text-sm text-soft">{path}</span>}
        {refused && <span className="block font-serif text-sm text-soft">{refused}</span>}
      </span>
      {chosen && <CheckIcon className="size-5 shrink-0 text-ink" strokeWidth={3} aria-label="Chosen" />}
      {opens && <ChevronRightIcon className="size-5 shrink-0 text-soft" strokeWidth={2} aria-label="Opens" />}
    </>
  );

  return (
    <li className="border-t border-faint first:border-t-0">
      {act ? (
        <button
          type="button"
          onClick={act}
          className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-1 py-3 text-left"
        >
          {body}
        </button>
      ) : (
        <div aria-disabled="true" className="flex w-full items-center gap-3 px-1 py-3">
          {body}
        </div>
      )}
    </li>
  );
}

// where to open: in the chosen circle itself, where Choose is ready to keep
// it, if it has circles inside; otherwise beside it, in its parent
export function startingFolder(value: string | null, circles: Circle[], byId: CirclesById): string | undefined {
  const chosen = value ? byId[value] : undefined;
  if (!chosen) return undefined;
  if (circles.some((c) => c.parentId === chosen.id)) return chosen.id;
  return chosen.parentId !== null && byId[chosen.parentId] ? chosen.parentId : chosen.id;
}

// in the order the Circles browser lists them: neighborhoods, Circles,
// groups, then organizations, each by name
function inKindOrder(circles: Circle[]): Circle[] {
  return circlesByKind([...circles].sort((a, b) => a.name.localeCompare(b.name))).flatMap((g) => g.circles);
}
