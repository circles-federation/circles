"use client";

import { useMemo } from "react";
import { CheckIcon, ChevronRightIcon, HomeIcon, UserIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { circleAncestors, circlesByKind, indexCircles } from "@/lib/circles.util";
import type { CirclePlace } from "@/lib/types";
import { Badge } from "./badge";
import { CircleTypeIcon } from "./circle-type-icon";
import { EmptyState } from "./empty-state";
import { SearchWithFilter } from "./search-with-filter";

/* What the explorer needs of a circle: where it sits and what it is, and its
   members only where there's a member to mark it for (outside the app, the
   application form's neighborhoods, there's neither) */
export type ExplorerCircle = CirclePlace & { members?: number[] };

// whoever's choosing, signed in, for marking their neighborhood and their circles
export interface ExplorerYou {
  id: number;
  homeCircleId: string | null;
}

interface FederationExplorerProps<T extends ExplorerCircle> {
  // the circles it shows, as the field using it decides (Parent circle: every
  // circle the member can see)
  circles: T[];
  // the one picked, checked where it's listed, and the field's value as it
  // stands, marked Current wherever it's listed, so it's still found after
  // a pick or some browsing
  picked: string | null;
  current: string | null;
  // why a circle can't be chosen here, in a few words under it, or null when
  // it can. One that can't is still opened, to reach those inside it
  refusal: (circle: T) => string | null;
  you?: ExplorerYou;
  // the circle it's in, and what's being searched for: held by
  // useFederationExplorer, whose Done (in the top bar or the dialog's
  // header) keeps the circle picked, or else the circle it's in
  at: string;
  onOpen: (id: string) => void;
  query: string;
  onQuery: (query: string) => void;
  // a tap on a circle with none inside, which picks it, or lets it go if
  // it's picked already
  onPick: (id: string) => void;
}

/* Choosing a circle from the whole federation the way a file is chosen from
   folders: one level at a time from the city down, with breadcrumbs back up.
   A circle with circles inside opens when tapped, and is kept from inside,
   by the Done its holder puts in the top bar or the dialog's header; one
   with none is picked with a tap (a second lets it go), and kept by Done.
   What can't be chosen is grey, saying why, and opens all the same. A search flattens the tree, each result with its
   path. Opened through useFederationExplorer. */
export function FederationExplorer<T extends ExplorerCircle>({ circles, picked, current, refusal, you, at, onOpen, query, onQuery, onPick }: FederationExplorerProps<T>) {
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
              {folder.id === current && <Badge variant="subtle">Current</Badge>}
            </span>
          </nav>
          {/* why Done can't keep this one */}
          {folderRefusal && <p className="mt-1 font-serif text-sm text-soft">{folderRefusal}</p>}
        </div>
      )}

      {listed.length > 0 ? (
        <ul className="m-0 list-none border-y border-faint p-0">
          {listed.map((c) => (
            <ExplorerRow
              key={c.id}
              circle={c}
              you={you}
              path={q ? circleAncestors(c, byId).map((a) => a.name).join(" › ") : null}
              opens={childrenOf(c.id).length > 0}
              picked={c.id === picked}
              current={c.id === current}
              refused={refusal(c)}
              onOpen={() => onOpen(c.id)}
              onPick={() => onPick(c.id)}
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
  circle: ExplorerCircle;
  you: ExplorerYou | undefined;
  // where it sits, for a search result
  path: string | null;
  // it has circles inside, so a tap opens it
  opens: boolean;
  picked: boolean;
  current: boolean;
  refused: string | null;
  onOpen: () => void;
  onPick: () => void;
}

// a circle in the list: its icon, its name (marked, like the home on your
// neighborhood, with a person on a circle you're a member of, and Current if
// it's the field's value), why it can't be chosen, a check if it's picked,
// and a chevron if it opens
function ExplorerRow({ circle: c, you, path, opens, picked, current, refused, onOpen, onPick }: ExplorerRowProps) {
  const home = !!you && c.id === you.homeCircleId;
  const member = !!you && !home && !!c.members?.includes(you.id);
  const act = opens ? onOpen : refused ? null : onPick;

  const body = (
    <>
      <CircleTypeIcon circle={c} className={clsx("size-5 shrink-0", refused ? "text-ghost" : "text-ink")} strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={clsx("font-sans text-base font-semibold", refused ? "text-soft" : "text-ink")}>{c.name}</span>
          {home && <HomeIcon className="size-4 shrink-0 text-teal" strokeWidth={2.5} aria-label="Your neighborhood" />}
          {member && <UserIcon className="size-4 shrink-0 text-teal" strokeWidth={2.5} aria-label="You're a member" />}
          {current && <Badge variant="subtle">Current</Badge>}
        </span>
        {path && <span className="block truncate font-sans text-sm text-soft">{path}</span>}
        {refused && <span className="block font-serif text-sm text-soft">{refused}</span>}
      </span>
      {picked && <CheckIcon className="size-5 shrink-0 text-ink" strokeWidth={3} aria-label="Picked" />}
      {opens && <ChevronRightIcon className="size-5 shrink-0 text-soft" strokeWidth={2} aria-label="Opens" />}
    </>
  );

  return (
    <li className="border-t border-faint first:border-t-0">
      {act ? (
        <button
          type="button"
          onClick={act}
          {...(opens ? {} : { "aria-pressed": picked })}
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

// where to open: in the chosen circle itself, if it has circles inside;
// otherwise beside it, in its parent
export function startingFolder(value: string | null, circles: ExplorerCircle[], byId: Record<string, ExplorerCircle>): string | undefined {
  const chosen = value ? byId[value] : undefined;
  if (!chosen) return undefined;
  if (circles.some((c) => c.parentId === chosen.id)) return chosen.id;
  return chosen.parentId !== null && byId[chosen.parentId] ? chosen.parentId : chosen.id;
}

// in the order the Circles browser lists them: neighborhoods, Circles,
// groups, then organizations, each by name
function inKindOrder<T extends ExplorerCircle>(circles: T[]): T[] {
  return circlesByKind([...circles].sort((a, b) => a.name.localeCompare(b.name))).flatMap((g) => g.circles);
}
