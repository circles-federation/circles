import clsx from "clsx";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Avatar, Eyebrow, CappedChip, PrivateLabel } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_TYPE_LABEL, circleNeighborhood, circleIsPrivate, startedInside } from "@/lib/circles.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Circle } from "@/lib/types";

interface CircleCardProps {
  c: Circle;
  onOpenCircle: (c: Circle) => void;
  showNeighborhoodChip?: boolean;
  showKindEyebrow?: boolean;
}

/* Reusable circle card — used in the Circles directory and the Home
   dashboard's "my circles" speed dial, so they look identical. A
   neighborhood displays differently from every other circle: no neighborhood chip
   (it IS the neighborhood, so showing one would be redundant). The viewer's own
   home neighborhood card also gets a small teal home icon next to its title
   (matching NeighborhoodPage's page-title treatment when browsing inside
   that same folder).

   The chip names where it sits: its neighborhood, or for a circle started
   inside another, that circle. showNeighborhoodChip defaults on for flat lists that mix neighborhoods (Home's "my circles"
   speed dial, CirclesRootPage) but callers rendering a single circle's own
   children (NeighborhoodPage, CirclePage's Sub-circles) pass false — every
   card in such a list structurally shares that folder's own neighborhood, so
   repeating it on each card would be redundant.

   showKindEyebrow controls the type eyebrow ("Neighborhood", "Collective",
   ...) and defaults on for everything except a neighborhood. But any caller
   can override in either direction when its own grid label already says what
   the eyebrow would: NeighborhoodPage's Circles grid passes false, since
   "Circles" is right there in the section header; Home's speed dial passes
   true for its neighborhood card, since that's a single flat, mixed-type list
   with no grid label to lean on. */
export function CircleCard({ c, onOpenCircle, showNeighborhoodChip = true, showKindEyebrow = c.type !== "neighborhood" }: CircleCardProps) {
  const { profile } = useAppState();
  const byId = useCirclesById();
  const memberById = useMemberById();
  const isNeighborhood = c.type === "neighborhood";
  const isHome = c.id === profile.homeCircleId;
  const hood = circleNeighborhood(c, byId);
  // one started inside another circle is placed by that circle, the one it
  // answers to, rather than the neighborhood further up
  const inside = startedInside(c, byId);

  return (
    // items-stretch: a <button>'s default is align-items: flex-start, which
    // leaves each row only as wide as its content, so the type/chip row had no
    // room for justify-between to push the chip to the far side
    <button
      onClick={() => onOpenCircle(c)}
      className="ink-press bg-paper flex cursor-pointer flex-col items-stretch border-r border-b border-ink p-6 text-left"
    >
      {showKindEyebrow && (
        <div className="mb-3 flex min-h-[26.5px] items-center justify-between gap-2">
          <Eyebrow className="shrink-0 text-soft">
            {circleIsPrivate(c) ? <PrivateLabel>{CIRCLE_TYPE_LABEL[c.type]}</PrivateLabel> : CIRCLE_TYPE_LABEL[c.type]}
          </Eyebrow>
          {!isNeighborhood && showNeighborhoodChip && inside ? (
            <CappedChip title={`Inside ${inside.name}`}>{inside.name}</CappedChip>
          ) : !isNeighborhood && showNeighborhoodChip && hood !== null ? (
            <CappedChip title={hood.id === profile.homeCircleId ? "Local to this neighborhood" : "Across the federation"}>{hood.name}</CappedChip>
          ) : null}
        </div>
      )}
      <div className="flex items-center gap-2 font-sans text-xl leading-none font-extrabold tracking-[-0.025em]">
        {c.name}
        {isHome && <HomeIcon className="size-5 shrink-0 text-teal" strokeWidth={2} />}
      </div>
      <p className="mt-3 font-serif text-sm leading-[1.4] text-body">{c.tagline}</p>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="flex">
          {/* member ids on a circle always resolve — internal seed-data
              invariant, not a runtime possibility to guard */}
          {c.members.slice(0, 8).map((id, i) => (
            <Avatar key={id} member={memberById(id)!} size={26} className={clsx(i !== 0 && "-ml-2")} />
          ))}
        </span>
      </div>
    </button>
  );
}
