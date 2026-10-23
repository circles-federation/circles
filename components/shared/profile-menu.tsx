"use client";

import { Cog6ToothIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { avatarFor } from "@/lib/members.util";
import { TopBarMenu } from "./top-bar-menu";

/* Home's top bar action: the member's own photo, opening the places about
   them (their profile, as others see it, and Settings). */
export function ProfileMenu() {
  const { profile } = useAppState();
  return (
    <TopBarMenu
      label="You"
      face={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- the member's own photo, by version */}
          <img src={avatarFor(profile)} alt="" className="size-full object-cover" />
          {/* a ring drawn inside the circle, over the photo, so it keeps its size */}
          <span aria-hidden className="absolute inset-0 rounded-full border border-ink" />
        </>
      }
      items={[
        { label: "My profile", href: `/profile/${profile.id}`, icon: UserCircleIcon },
        { label: "Settings", href: "/settings", icon: Cog6ToothIcon },
      ]}
    />
  );
}
