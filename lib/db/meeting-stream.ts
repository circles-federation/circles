import type { MeetingSession } from "@/lib/types";
import { getMeetingForFanout } from "./meeting-sessions";
import { MEETING_CHANNEL } from "./meeting-channel";
import { PgListener } from "./pg-listener";

/* What keeps every open meeting page current. Every write in
   lib/db/meeting-sessions.ts NOTIFYs the meeting's event id; this reads the
   session (null before it starts) and its circle's members once and hands it to
   the streams (app/api/meetings/[id]/stream) of those members watching that
   meeting, and no one else: membership is read at that moment. A session is
   sent whole, so a stream that reconnects needs no replay, only the current
   one. */

export interface MeetingSubscriber {
  memberId: number;
  eventId: string;
  onSession(session: MeetingSession | null): void;
  // the listening connection came back after a gap: read afresh
  onReset(): void;
}

const listener = new PgListener(MEETING_CHANNEL);

class MeetingHub {
  private subscribers = new Set<MeetingSubscriber>();
  private unlisten: (() => void) | null = null;

  subscribe(subscriber: MeetingSubscriber): () => void {
    this.subscribers.add(subscriber);
    this.unlisten ??= listener.subscribe({
      onPayload: (eventId) => void this.fanOut(eventId),
      onReset: () => {
        for (const s of this.subscribers) s.onReset();
      },
    });
    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) {
        this.unlisten?.();
        this.unlisten = null;
      }
    };
  }

  private async fanOut(eventId: string) {
    const watching = [...this.subscribers].filter((s) => s.eventId === eventId);
    if (watching.length === 0) return;
    const found = await getMeetingForFanout(eventId).catch(() => null);
    if (!found) return;
    for (const s of watching) if (found.memberIds.includes(s.memberId)) s.onSession(found.session);
  }
}

// one per process, surviving the dev server's module reloads
const globalForHub = globalThis as unknown as { meetingHub?: MeetingHub };
export const meetingHub = (globalForHub.meetingHub ??= new MeetingHub());
