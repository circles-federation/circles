"use client";

import { NotificationSettingsPage } from "@/components/settings/notification-settings.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";

export default function Page() {
  // back to Settings once saved or discarded
  const goBack = useGoBack();
  const { profile, saveNotificationSettings } = useAppState();

  return <NotificationSettingsPage settings={profile.notifications} hasEmail={!!profile.email} onSave={saveNotificationSettings} onBack={goBack} />;
}
