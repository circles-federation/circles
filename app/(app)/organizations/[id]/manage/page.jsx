"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { ManageOrgPage } from "@/components/orgs/manage-org.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const { id } = useParams();
  const router = useRouter();
  const { orgs, saveOrg } = useAppState();

  const org = orgs.find((o) => o.id === id);
  if (!org) notFound();

  return (
    <ManageOrgPage
      org={org}
      onSave={(patch) => saveOrg(org.id, patch)}
      onBack={() => router.back()}
    />
  );
}
