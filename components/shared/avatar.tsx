"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor, MEMBERS } from "@/lib/data";
import { sharesOrgWith } from "@/lib/orgs.util";
import type { Member } from "@/lib/types";

interface AvatarProps {
  member: Member;
  size?: number;
  className?: string;
}

/* A member's profile photo — but only to a viewer who shares an org with
   them (see sharesOrgWith in lib/orgs.util.ts), including the automatic
   Neighborhood Council membership every resident of a neighborhood has, so
   simply living in the same neighborhood is enough. A stranger outside the
   viewer's circle sees a plain gray square with a generic person icon
   instead of their actual face. The viewer's own photo is always visible
   regardless. `size` is a pixel number (avatars appear at many different
   sizes across the app); className adds border/shrink/etc. on top. */
export function Avatar({ member: m, size = 44, className }: AvatarProps) {
  const { profile, orgs } = useAppState();
  const visible = m.id === profile.id || sharesOrgWith(profile.id, m.id, orgs, MEMBERS);
  const style: CSSProperties = { width: size, height: size };

  if (!visible) {
    return (
      <div style={style} className={clsx("flex shrink-0 items-center justify-center border border-ink bg-faint", className)}>
        <UserIcon className="h-1/2 w-1/2 text-soft" strokeWidth={1.5} />
      </div>
    );
  }

  return <img src={avatarFor(m)} alt="" style={style} className={clsx("shrink-0 border border-ink object-cover", className)} />;
}
