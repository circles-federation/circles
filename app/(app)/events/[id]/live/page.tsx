"use client";

import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import { MeetingWizardPage } from "@/components/events/meeting-wizard.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { isCircleMember } from "@/lib/circles.util";
import { awaitingConsent, isMeeting } from "@/lib/governance.util";

function LiveMeeting() {
  const { id } = useParams<{ id: string }>();
  const { events, circles, profile } = useAppState();
  const event = events.find((e) => e.id === id);
  const circle = event ? circles.find((c) => c.id === event.circleId) : undefined;
  // a meeting is its circle's: anyone else has nothing here, nor does one that's
  // cancelled or still being decided
  if (!event || !circle || !isMeeting(event) || event.cancelled || awaitingConsent(event) || !isCircleMember(circle, profile.id)) notFound();
  return <MeetingWizardPage event={event} circle={circle} memberId={profile.id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LiveMeeting />
    </Suspense>
  );
}
