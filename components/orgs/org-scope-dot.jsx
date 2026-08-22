"use client";

import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";

const PROVIDENCE = "Providence"; // the city federation's name (org level)

/* A compact scope indicator for org cards — a plain colored dot, no icon
   or text, since a card's header row is too tight for the full chip used
   on the org's own page (see OrgScopeBadge). Purple if the viewer is a
   member of the org, teal if it's merely local to their neighborhood, and
   nothing at all for a Providence-scoped (federation-wide) org. */
export function OrgScopeDot({ org, className }) {
  const { profile } = useAppState();
  if (org.level === PROVIDENCE) return null;
  const isMember = org.members.includes(profile.id);

  return (
    <span
      title={isMember ? "You're a member" : "Local to this neighborhood"}
      className={clsx("size-3 rounded-full", isMember ? "bg-plum" : "bg-teal", className)}
    />
  );
}
