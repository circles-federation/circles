"use client";

import { CityDirectoryPage } from "@/components/directory/city-directory.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { orgs } = useAppState();
  const nav = useAppNav();

  return <CityDirectoryPage orgs={orgs} onOpenOrg={nav.openOrg} />;
}
