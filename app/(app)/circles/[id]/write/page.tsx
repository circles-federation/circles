"use client";

import { notFound, useParams } from "next/navigation";
import { WriteMessagePage } from "@/components/circles/write-message.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { circleHasInbox } from "@/lib/circles.util";

// writing to a circle, from the square on its wiki: only while its Inbox is
// on; done, it goes back there
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { circles } = useAppState();
  const goBack = useGoBack(`/circles/${id}/wiki`);
  const circle = circles.find((c) => c.id === id);
  if (!circle || !circleHasInbox(circle)) notFound();
  return <WriteMessagePage circle={circle} onDone={goBack} />;
}
