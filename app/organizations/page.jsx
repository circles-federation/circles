"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrgDirectory } from "@/components/orgs/org-directory.page";
import { useAppNav } from "@/lib/hooks";

function OrganizationsDirectory() {
  const searchParams = useSearchParams();
  const nav = useAppNav();

  return <OrgDirectory onOpenOrg={nav.openOrg} initialLevel={searchParams.get("level")} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrganizationsDirectory />
    </Suspense>
  );
}
