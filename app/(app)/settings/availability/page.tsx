"use client";

import { AvailabilitySettingsPage } from "@/components/settings/availability-settings.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";

export default function Page() {
  // back to Settings once saved or discarded
  const goBack = useGoBack();
  const { profile, saveAvailability } = useAppState();

  return <AvailabilitySettingsPage windows={profile.availability} onSave={saveAvailability} onBack={goBack} />;
}
