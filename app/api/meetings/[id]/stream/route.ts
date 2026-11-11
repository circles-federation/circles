import { meetingHub } from "@/lib/db/meeting-stream";
import { getMeetingSession, memberHasMeeting } from "@/lib/db/meeting-sessions";
import { getCurrentUserId } from "@/lib/session";
import type { MeetingSession } from "@/lib/types";

/* One meeting's live stream (Server-Sent Events) for a member of its circle:
   the session as it stands (`session`, with `null` data until it starts) when
   it opens and again whenever it changes. Whole sessions, so a reconnect needs
   no replay: the first event is the current one. Authorization is the session
   and membership of the meeting's circle, checked again as it goes. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// under the idle timeout of the proxies in front of the server
const HEARTBEAT_MS = 25_000;
// every this many beats, the session is checked again: about 2 minutes
const SESSION_CHECK_BEATS = 5;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const memberId = await getCurrentUserId();
  if (!memberId) return new Response("Sign in again.", { status: 401 });
  if (!(await memberHasMeeting(memberId, eventId))) return new Response("Not found.", { status: 404 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (open) controller.enqueue(encoder.encode(chunk));
      };
      let lastRev = -1;
      let started = false;
      // a session older than one already sent (two changes announced close
      // together may be read out of order) is dropped
      const sendSession = (session: MeetingSession | null) => {
        if (session && started && session.rev < lastRev) return;
        if (session) lastRev = session.rev;
        started = started || session !== null;
        send(`event: session\ndata: ${JSON.stringify(session)}\n\n`);
      };
      const readNow = () =>
        getMeetingSession(memberId, eventId)
          .then(sendSession)
          .catch(() => {});

      send(`retry: 3000\n\n`);
      // subscribe before reading, so nothing written in between is missed
      const unsubscribe = meetingHub.subscribe({ memberId, eventId, onSession: sendSession, onReset: () => void readNow() });
      const leave = () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      };
      let beats = 0;
      const heartbeat = setInterval(() => {
        send(`: ping\n\n`);
        if (++beats % SESSION_CHECK_BEATS !== 0) return;
        // signed out, or no longer in the circle, since it opened: stop sending
        void Promise.all([getCurrentUserId(), memberHasMeeting(memberId, eventId)])
          .then(([current, still]) => (current !== memberId || !still) && leave())
          .catch(() => {});
      }, HEARTBEAT_MS);
      cleanup = () => {
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
      };
      // it may have gone while the above was awaited, which would never fire again
      if (request.signal.aborted) return leave();
      request.signal.addEventListener("abort", leave);
      await readNow();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
