"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightStartOnRectangleIcon, Cog6ToothIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { logout } from "@/lib/auth";
import { avatarFor } from "@/lib/members.util";
import { unsubscribeThisDevice } from "@/lib/push-client";
import { ConfirmModal } from "./confirm-modal";
import { TopBarMenu } from "./top-bar-menu";

/* Home's top bar action: the member's own photo, opening the places about
   them (their profile, as others see it, and Settings), and logging out, in
   red at the foot, which asks first. */
export function ProfileMenu() {
  const { profile } = useAppState();
  const router = useRouter();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // the action itself is pure (clears the session, doesn't navigate), so the
  // redirect is done here once it resolves. This device stops getting the
  // member's notifications first, while there's still a session to tell the
  // server with.
  async function handleLogout() {
    await unsubscribeThisDevice();
    await logout();
    router.push("/");
  }

  return (
    <>
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
          { label: "Log out", icon: ArrowRightStartOnRectangleIcon, danger: true, onSelect: () => setConfirmingLogout(true) },
        ]}
      />
      {confirmingLogout && (
        <ConfirmModal
          title="Log out?"
          message="You'll need a new code from your email to sign back in."
          confirmLabel="Log out"
          cancelLabel="Stay"
          onConfirm={handleLogout}
          onCancel={() => setConfirmingLogout(false)}
        />
      )}
    </>
  );
}
