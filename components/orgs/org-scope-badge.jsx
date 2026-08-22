"use client";

import { HomeIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";

const PROVIDENCE = "Providence"; // the city federation's name (org level)

/* An org's scope chip, shown on the org's own page — always the home icon
   plus the neighborhood name (distinct from OrgScopeDot's card-sized dot,
   which drops the text entirely for space). Purple if the viewer is a
   member of the org; otherwise teal, which — given AppStateProvider's
   visibility filter — can only mean the org is local to the viewer's own
   neighborhood, since a non-member never reaches this page for an org
   scoped elsewhere. Renders nothing for a Providence-scoped
   (federation-wide) org. */
export function OrgScopeBadge({ org, className }) {
  const { profile } = useAppState();
  if (org.level === PROVIDENCE) return null;
  const isMember = org.members.includes(profile.id);

  return (
    <span
      title={isMember ? "You're a member" : "Local to this neighborhood"}
      className={clsx(
        "inline-flex items-center gap-1 border px-2 py-0.75 font-sans text-label font-bold uppercase tracking-[0.08em]",
        isMember ? "border-plum bg-plum text-paper" : "border-teal bg-teal text-paper",
        className,
      )}
    >
      <HomeIcon className="size-3.5" strokeWidth={2} />
      {org.level}
    </span>
  );
}
