"use client";

import { notFound, useParams } from "next/navigation";
import { MessagePage } from "@/components/circles/message.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

// one message to a circle's Inbox: only its members are sent it, so to
// anyone else it doesn't exist
export default function Page() {
  const { id, messageId } = useParams<{ id: string; messageId: string }>();
  const { circles, messages } = useAppState();
  const nav = useAppNav();
  const message = messages.find((m) => m.id === messageId && m.circleId === id);
  const circle = circles.find((c) => c.id === id);
  if (!message || !circle) notFound();
  return <MessagePage message={message} circle={circle} onOpenMember={nav.openMember} />;
}
