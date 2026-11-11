"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingSession } from "./types";

/* A meeting's session, kept current by its stream (app/api/meetings/[id]/stream):
   `undefined` until the first reading, `null` when it hasn't started. An
   action's result is adopted at once with `adopt`, so the person who did it
   needn't wait for the stream to say so; a session older than the one held
   (the two may arrive in either order) is ignored. The browser reconnects the
   stream by itself and the first thing it sends is the current session, so
   nothing is replayed. `lost` is a stream that has closed for good (signed out,
   or no longer in the circle). */
export function useMeetingSession(eventId: string, enabled = true) {
  const [session, setSession] = useState<MeetingSession | null | undefined>(undefined);
  const [lost, setLost] = useState(false);

  const adopt = useCallback((next: MeetingSession | null) => {
    setSession((current) => (current && next && next.rev < current.rev ? current : next));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`/api/meetings/${eventId}/stream`);
    source.addEventListener("session", (e) => adopt(JSON.parse((e as MessageEvent<string>).data) as MeetingSession | null));
    source.onopen = () => setLost(false);
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) setLost(true);
    };
    return () => source.close();
  }, [eventId, enabled, adopt]);

  return { session, adopt, lost };
}
