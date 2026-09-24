"use client";

import { useRouter } from "next/navigation";
import { EditMyselfPage } from "@/components/profile/edit-myself.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const router = useRouter();
  const { profile, saveProfile, savePhoto } = useAppState();

  return (
    <EditMyselfPage
      profile={profile}
      onSave={saveProfile}
      onSavePhoto={savePhoto}
      onBack={() => router.push("/home")}
    />
  );
}
