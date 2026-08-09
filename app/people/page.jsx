"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Directory } from "@/components/directory/directory.page";
import { useProfileModal } from "@/components/providers/profile-modal-provider";

function PeopleDirectory() {
  const searchParams = useSearchParams();
  const { open } = useProfileModal();

  return <Directory onOpenMember={open} initialHood={searchParams.get("hood")} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PeopleDirectory />
    </Suspense>
  );
}
