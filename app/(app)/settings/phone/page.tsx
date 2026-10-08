"use client";

import { PhoneSettingsPage } from "@/components/settings/phone-settings.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";

export default function Page() {
  // back to Settings once it's confirmed or removed
  const goBack = useGoBack();
  const { profile, requestPhoneCode, confirmPhone, removePhone } = useAppState();

  return <PhoneSettingsPage phone={profile.phone} onRequestCode={requestPhoneCode} onConfirm={confirmPhone} onRemove={removePhone} onBack={goBack} />;
}
