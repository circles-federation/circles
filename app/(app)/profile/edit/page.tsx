"use client";

import { EditMyselfPage } from "@/components/profile/edit-myself.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";

export default function Page() {
  // back to wherever it was opened from: Settings, or your own profile page
  const goBack = useGoBack();
  const { profile, saveProfile, savePhoto } = useAppState();

  return (
    <EditMyselfPage
      profile={profile}
      onSave={saveProfile}
      onSavePhoto={savePhoto}
      onBack={goBack}
    />
  );
}
