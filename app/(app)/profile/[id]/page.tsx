"use client";

import { notFound, useParams } from "next/navigation";
import { MemberProfilePage } from "@/components/profile/member-profile.page";
import { useAppNav, useMemberById } from "@/lib/hooks";

// a member's profile, opened from anywhere a member is shown (useAppNav's
// openMember). /profile/edit is its own, static route.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const memberById = useMemberById();
  const nav = useAppNav();

  const member = memberById(Number(id));
  if (!member) notFound();

  return <MemberProfilePage member={member} onOpenCircle={(c) => nav.openCircle(c)} />;
}
