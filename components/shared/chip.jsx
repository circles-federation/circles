"use client";

import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";

/* A small place badge. Solid ink = elsewhere/federation-level (the noteworthy
   case); hollow = local to this neighborhood (the quiet default).            */
const FEDERATION_LABEL = "Providence"; // the city federation's name (org level)
export function Chip({ children, title }) {
  // color is derived from the place: the CURRENT USER's own neighborhood is
  // teal, the city federation is black, any other neighborhood is a white
  // outline. Compared against the signed-in member's own neighborhood, not a
  // fixed constant — this is a shared login, and whoever's signed in should
  // see their own home highlighted, not always "The 903".
  const { profile } = useAppState();
  const place = typeof children === "string" ? children : "";
  const local = place === profile.neighborhood;
  const federation = place === FEDERATION_LABEL;

  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap border px-2.25 py-1 font-sans text-label font-bold uppercase tracking-[0.08em]",
        local ? "border-teal bg-teal text-paper" : federation ? "border-ink bg-ink text-paper" : "border-ink bg-paper text-ink",
      )}
    >
      <span className="text-micro opacity-[0.85]">◆</span>
      {children}
    </span>
  );
}
