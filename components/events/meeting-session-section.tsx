"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetingMinutes } from "./meeting-minutes";
import { Button, Eyebrow } from "@/components/shared";
import { useToast } from "@/components/shared/toast";
import { startMeetingAction } from "@/lib/db/actions";
import { useClock, useMemberById } from "@/lib/hooks";
import { canRunMeeting } from "@/lib/meeting-session.util";
import type { Event, MeetingSession } from "@/lib/types";

/* What a meeting's page says about its being held, for the circle's members:
   from its start time, a card to run it, or while it's going to join it (the
   same wizard, for everyone), and once it's finished its minutes. The meeting
   itself is /events/[id]/live. The page holds the session (from the meeting's
   stream, opened only once it could have begun), `undefined` until it's read. */
export function MeetingSessionSection({ event: e, session }: { event: Event; session: MeetingSession | null | undefined }) {
  const now = useClock();
  const router = useRouter();
  const { showToast } = useToast();
  const memberById = useMemberById();
  const [starting, setStarting] = useState(false);
  if (now === null || session === undefined) return null;

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
