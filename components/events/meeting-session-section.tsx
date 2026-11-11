"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetingMinutes } from "./meeting-minutes";
import { Button, Eyebrow } from "@/components/shared";
import { useToast } from "@/components/shared/toast";
import { startMeetingAction } from "@/lib/db/actions";
import { awaitingConsent } from "@/lib/governance.util";
import { useClock, useMemberById } from "@/lib/hooks";
import { canRunMeeting } from "@/lib/meeting-session.util";
import { eventStartsAt } from "@/lib/events.util";
import { useMeetingSession } from "@/lib/use-meeting-session";
import type { Event } from "@/lib/types";

/* What a meeting's page says about its being held, for the circle's members:
   from its start time, a card to run it, or while it's going to join it (the
   same wizard, for everyone), and once it's finished its minutes. The meeting
   itself is /events/[id]/live. */
export function MeetingSessionSection({ event: e }: { event: Event }) {
  const now = useClock();
  const router = useRouter();
  const { showToast } = useToast();
  const memberById = useMemberById();
  const [starting, setStarting] = useState(false);
  // the stream is opened only once the meeting could have begun, so the page
  // of one still to come holds no connection
  const open = !e.cancelled && !awaitingConsent(e) && now !== null && now >= eventStartsAt(e).getTime();
  const { session } = useMeetingSession(e.id, open);
  if (!open || session === undefined) return null;

  if (session?.status === "finished") {
    return (
      <section className="border-b border-faint py-8">
        <Eyebrow className="text-soft">Minutes</Eyebrow>
        <div className="mt-4">
          <MeetingMinutes session={session} />
        </div>
      </section>
    );
  }

  const live = session?.status === "live";
  if (!live && !canRunMeeting(e, new Date(now))) return null;
  const facilitator = live && session.facilitatorId !== null ? memberById(session.facilitatorId) : undefined;

  const go = async () => {
    setStarting(true);
    const result = await startMeetingAction(e.id);
    if (!result.ok) {
      setStarting(false);
      return showToast({ message: result.error, tone: "error" });
    }
    router.push(`/events/${e.id}/live`);
  };

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-ink p-6 text-paper">
      <div className="min-w-0">
        <Eyebrow className="text-paper">{live ? "Meeting in progress" : "Ready to begin"}</Eyebrow>
        <p className="mt-1 font-serif text-base">
          {live ? (facilitator ? `${facilitator.name} is facilitating.` : "Everyone in the circle can join.") : "Start the meeting for everyone in the circle to follow along."}
        </p>
      </div>
      <Button variant="secondary" disabled={starting} onClick={go}>
        {live ? "Join meeting" : "Run meeting"}
      </Button>
    </section>
  );
}
