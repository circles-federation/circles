"use client";

import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import { MeetingMinutesEditPage } from "@/components/events/meeting-minutes-edit.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { isCircleMember } from "@/lib/circles.util";
import { awaitingConsent, isMeeting } from "@/lib/governance.util";

function EditMinutes() {
  const { id } = useParams<{ id: string }>();
  const { events, circles, profile } = useAppState();
  const event = events.find((e) => e.id === id);
  const circle = event ? circles.find((c) => c.id === event.circleId) : undefined;
  // the minutes are the meeting's circle's: anyone else has nothing here
  if (!event || !circle || !isMeeting(event) || event.cancelled || awaitingConsent(event) || !isCircleMember(circle, profile.id)) notFound();
  return <MeetingMinutesEditPage event={event} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditMinutes />
    </Suspense>
  );
}
