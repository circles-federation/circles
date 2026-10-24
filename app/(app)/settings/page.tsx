"use client";

import { SettingsPage } from "@/components/settings/settings.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const { profile } = useAppState();
  return <SettingsPage notifications={profile.notifications} availability={profile.availability} />;
}
