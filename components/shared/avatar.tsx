"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { sharesCircleWith } from "@/lib/circles.util";
import { avatarFor, pendingPhotoFor } from "@/lib/members.util";
import type { Member } from "@/lib/types";

interface AvatarProps {
  member: Member;
  size?: number;
  // Tailwind size classes in place of `size`, for an avatar whose size changes
  // with the screen (Home's own): CSS breakpoints apply from the first paint,
  // where a JS width check would only correct the size once it had rendered
  sizeClassName?: string;
  className?: string;
  // for the viewer's own photo where they look at themselves (Home, their
  // profile, Edit profile): a new one waiting for review, marked as such
  showPending?: boolean;
}

/* A member's profile photo — but only to a viewer who shares a circle with
   them (see sharesCircleWith in lib/circles.util.ts), including their
   neighborhood, so simply living in the same neighborhood is enough. A stranger outside the
   viewer's circle sees a plain gray square with a generic person icon
   instead of their actual face. The viewer's own photo is always visible
   regardless. `size` is a pixel number (avatars appear at many different
   sizes across the app); className adds border/shrink/etc. on top. With
   showPending, the viewer's own new photo, if one is waiting for review,
   under a band saying so: they see what they sent, everyone else the photo
   they had. */
export function Avatar({ member: m, size = 44, sizeClassName, className, showPending }: AvatarProps) {
  const { profile, circles } = useAppState();
  const visible = m.id === profile.id || sharesCircleWith(profile.id, m.id, circles);
  const style: CSSProperties | undefined = sizeClassName ? undefined : { width: size, height: size };

  if (!visible) {
    return (
      <div style={style} className={clsx("flex shrink-0 items-center justify-center border border-ink bg-faint", sizeClassName, className)}>
        <UserIcon className="h-1/2 w-1/2 text-soft" strokeWidth={1.5} />
      </div>
    );
  }

  if (showPending && m.id === profile.id && profile.pendingPhotoVersion) {
    return (
      <div style={style} title="Waiting for review. Until it's approved, others see your current photo." className={clsx("relative shrink-0 border border-ink", sizeClassName, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served only to the member and admins, by version */}
        <img src={pendingPhotoFor(m.id, profile.pendingPhotoVersion)} alt="" className="size-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center font-sans text-label font-bold tracking-caps text-paper uppercase">In review</span>
      </div>
    );
  }

  return <img src={avatarFor(m)} alt="" style={style} className={clsx("shrink-0 border border-ink object-cover", sizeClassName, className)} />;
}
