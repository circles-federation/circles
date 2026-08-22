"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrgDirectory } from "@/components/orgs/org-directory.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

function OrganizationsDirectory() {
  const searchParams = useSearchParams();
  const nav = useAppNav();
  const { orgs } = useAppState();

  return <OrgDirectory orgs={orgs} onOpenOrg={nav.openOrg} initialLevel={searchParams.get("level")} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrganizationsDirectory />
    </Suspense>
  );
}
