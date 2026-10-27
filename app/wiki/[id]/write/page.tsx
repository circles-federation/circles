import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GuestWritePage } from "@/components/circles/guest-write.page";
import { getPublicWiki } from "@/lib/db/circles";
import { GUEST_MESSAGES_PER_DAY } from "@/lib/db/guest-messages";
import { getCurrentUserId } from "@/lib/session";

// a form, not a page worth listing
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

// writing to a circle from its public wiki, while its Inbox is on (proxy.ts
// lets /wiki/ through). A member writes from the app instead, as themselves.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wiki = await getPublicWiki(id);
  if (!wiki?.inbox) notFound();
  if (await getCurrentUserId()) redirect(`/circles/${id}/write`);
  return <GuestWritePage circle={{ id: wiki.id, name: wiki.name }} perDay={GUEST_MESSAGES_PER_DAY} />;
}
