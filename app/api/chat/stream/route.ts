import { chatHub } from "@/lib/db/chat-stream";
import { getChatChanges, getChatRev } from "@/lib/db/chat";
import { getCurrentUserId } from "@/lib/session";
import type { ChatMessage } from "@/lib/types";

/* The signed-in member's one live stream (Server-Sent Events) of every chat
   message written or changed in their circles. Each event's id is the
   message's version (`rev`), so a browser that reconnects by itself sends the
   last it saw (`Last-Event-ID`) and is caught up from there; a first
   connection says where its history ended with `?since=`, or gets only what
   happens from now. Authorization is the session, and the hub sends a message
   only to the members of its circle. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// under the idle timeout of the proxies in front of the server
const HEARTBEAT_MS = 25_000;
// every this many beats, the session is checked again: about 2 minutes
const SESSION_CHECK_BEATS = 5;

export async function GET(request: Request) {
  const memberId = await getCurrentUserId();
  if (!memberId) return new Response("Sign in again.", { status: 401 });

  const url = new URL(request.url);
  const header = request.headers.get("last-event-id");
  const asked = Number(header ?? url.searchParams.get("since"));
  const since = Number.isFinite(asked) && (header !== null || url.searchParams.has("since")) ? asked : null;

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (open) controller.enqueue(encoder.encode(chunk));
      };
      // a message just written is `message`; one that changed (and everything a
      // catch-up replays) is `update`, which the app doesn't count as unread
      const sendMessage = (m: ChatMessage, fresh = false) => send(`id: ${m.rev}\nevent: ${fresh ? "message" : "update"}\ndata: ${JSON.stringify(m)}\n\n`);
      let cursor = since ?? (await getChatRev());
      const began = cursor;

      // a catch-up that finds too much to send tells the client to read afresh
      const catchUp = async () => {
        const { messages, truncated } = await getChatChanges(memberId, cursor);
        if (truncated) {
          // its id moves the client's place on, so the next reconnect doesn't repeat this
          cursor = await getChatRev();
          return send(`id: ${cursor}\nevent: resync\ndata: {}\n\n`);
        }
        for (const m of messages) {
          sendMessage(m);
          cursor = Math.max(cursor, m.rev);
        }
      };

      send(`retry: 3000\n\n`);
      // subscribe before catching up, so nothing written in between is missed;
      // a client takes a message it's already seen as a no-op
      const unsubscribe = chatHub.subscribe({
        memberId,
        onMessage: (m, fresh) => {
          cursor = Math.max(cursor, m.rev);
          sendMessage(m, fresh);
        },
        // what it replays is "changed", not "new", so the client is also told to
        // count and read afresh
        onReset: () =>
          void catchUp()
            .catch(() => {})
            .then(() => send(`event: resync\ndata: {}\n\n`)),
      });
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
        // signed out or revoked since it opened: stop sending
        void getCurrentUserId()
          .then((current) => current !== memberId && leave())
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

      // its id lets a reconnect before any message arrives still resume from here
      if (since === null) send(`id: ${began}\nevent: ready\ndata: {}\n\n`);
      // and what was written between reading where to begin and subscribing is sent
      await catchUp().catch(() => send(`event: resync\ndata: {}\n\n`));
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
      // tells nginx-style proxies not to hold the stream back to batch it
      "X-Accel-Buffering": "no",
    },
  });
}
