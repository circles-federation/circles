"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { useAppState } from "@/components/providers/app-state-provider";
import { useCirclesById } from "@/lib/hooks";

// a ring: every chip names a circle (a neighborhood, a parent, an event's audience)
function CircleRingIcon() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" aria-hidden>
      <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

interface ChipProps {
  children: ReactNode;
  title?: string;
  // makes the chip a button that presses like the rest of the app
  onClick?: () => void;
}

// teal for the viewer's own neighborhood, ink for the city, a white outline
// for anywhere else
export type ChipTone = "local" | "federation" | "plain";

/* A small place badge. Solid ink = elsewhere/federation-level (the noteworthy
   case); hollow = local to this neighborhood (the quiet default).            */
export function Chip(props: ChipProps) {
  // color is derived from the place: the CURRENT USER's own neighborhood is
  // teal, the city federation is black, any other neighborhood is a white
  // outline. Compared against the signed-in member's own neighborhood, not a
  // fixed constant — this is a shared login, and whoever's signed in should
  // see their own home highlighted, not always "The 903".
  const { profile, circles } = useAppState();
  const byId = useCirclesById();
  const place = typeof props.children === "string" ? props.children : "";
  const local = !!profile.homeCircleId && place === byId[profile.homeCircleId]?.name;
  // the city (root circle) is the federation-level place
  const federation = place === circles.find((c) => c.parentId === null)?.name;
  return <ChipView {...props} tone={local ? "local" : federation ? "federation" : "plain"} />;
}

/* The chip as given its tone, where there's no member to work it out from
   (a circle's public wiki) */
export function ChipView({ children, title, onClick, tone }: ChipProps & { tone: ChipTone }) {
  const place = typeof children === "string" ? children : "";
  const local = tone === "local";
  const federation = tone === "federation";

  const className = clsx(
    // max-w-full + the truncating label: a long name ends in "…" rather than
    // pushing past its container (min-w-0 wherever a flex parent holds it)
    // a pill, set apart from the square-cornered cards and tags around it
    "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 font-sans text-label font-bold uppercase tracking-caps",
    // the hollow one keeps its white fill when its card is pressed (see .ink-press-badge)
    local ? "border-teal bg-teal text-paper" : federation ? "border-ink bg-ink text-paper" : "ink-press-badge border-ink bg-paper text-ink",
    // pressed, a filled chip turns paper and a hollow one ink, as buttons do
    onClick && ["hit cursor-pointer", local ? "btn-invert btn-teal" : federation ? "btn-invert btn-ink" : "ink-press"],
  );
  // a truncated name can still be read in full on hover
  const label = title ?? (place || undefined);
  const content = (
    <>
      <CircleRingIcon />
      <span className="min-w-0 truncate">{children}</span>
    </>
  );
  return onClick ? (
    <button type="button" title={label} onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <span title={label} className={className}>
      {content}
    </span>
  );
}

/* A chip sharing a row with an eyebrow, opposite it (at the top of a
   masthead: a circle's parent, a profile's neighborhood, a proposal's or
   event's circle; and on a CircleCard): capped at part of the row, so a long
   name ends in "…" instead of running off the screen or crowding out the
   eyebrow. `max` is that cap. */
export function CappedChip({ max = "max-w-[60%]", tone, ...chip }: ChipProps & { max?: string; tone?: ChipTone }) {
  return (
    <span className={clsx("flex min-w-0 shrink justify-end", max)}>
      {tone ? <ChipView {...chip} tone={tone} /> : <Chip {...chip} />}
    </span>
  );
}
