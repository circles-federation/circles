"use client";

import { useRouter } from "next/navigation";
import { SettingsPage } from "@/components/settings/settings.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { logout } from "@/lib/auth";
import { unsubscribeThisDevice } from "@/lib/push-client";

export default function Page() {
  const router = useRouter();
  const { profile } = useAppState();

  // the action itself is pure (clears the session, doesn't navigate), so the
  // caller does the redirect once it resolves. This device stops getting the
  // member's notifications first, while there's still a session to tell the
  // server with.
  async function handleLogout() {
    await unsubscribeThisDevice();
    await logout();
    router.push("/");
  }

  return <SettingsPage notifications={profile.notifications} availability={profile.availability} onLogout={handleLogout} />;
}
