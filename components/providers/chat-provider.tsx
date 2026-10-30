"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/shared";
import {
  deleteChatMessageAction,
  editChatMessageAction,
  getChatMessagesAction,
  getChatUnreadAction,
  markChatReadAction,
  sendChatMessageAction,
} from "@/lib/db/actions";
import type { ChatMessage } from "@/lib/types";
import { useAppState } from "./app-state-provider";

/* Circle chat, live (lib/db/chat.ts, app/api/chat/stream/route.ts). One
   Server-Sent Events stream for every circle the member is in, opened when
   the app is; a thread's messages are read when its page is first opened,
   then kept current by the stream. They're not in AppState, which is loaded
   whole and refreshed on a timer: a thread is unbounded and has to arrive
   the moment it's written.

   Unread counts are the server's at load, then bumped here as other people's
   messages arrive in a thread that isn't open, and read afresh whenever the
   stream may have missed something (a reconnect, coming back to the app).

   The browser reconnects a dropped stream by itself, sending the last event
   id it saw so the server catches it up. It can't when the browser gave up
   (the app was suspended, or the server was down), so then a new stream is
   opened at the last version seen (`?since=`). */

interface Thread {
  // oldest first
  messages: ChatMessage[];
  // whether there are earlier messages than these
  more: boolean;
}

interface ChatValue {
  unread: Record<string, number>;
  threads: Record<string, Thread | undefined>;
  // the thread of this circle is on screen: read it, and read it as it grows.
  // Returns what undoes that.
  view: (circleId: string) => () => void;
  loadEarlier: (circleId: string) => Promise<void>;
  // each resolves to why it failed, or null
  send: (circleId: string, body: string) => Promise<string | null>;
  edit: (id: number, body: string) => Promise<string | null>;
  remove: (id: number) => Promise<string | null>;
}

const ChatContext = createContext<ChatValue | null>(null);

export function useChat(): ChatValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}

// a message in its place in a thread, unless this copy is no newer than the one held
function upsert(list: ChatMessage[], m: ChatMessage): ChatMessage[] {
  const at = list.findIndex((x) => x.id === m.id);
  if (at >= 0) {
    if ((list[at]?.rev ?? 0) >= m.rev) return list;
    return list.map((x, i) => (i === at ? m : x));
  }
  const next = [...list, m];
  return next.length > 1 && (list[list.length - 1]?.id ?? 0) > m.id ? next.sort((a, b) => a.id - b.id) : next;
}

const READ_DEBOUNCE_MS = 400;
const RECONNECT_MS = [2000, 5000, 15000, 30000];

export function ChatProvider({ initialUnread, children }: { initialUnread: Record<string, number>; children: ReactNode }) {
  const { profile } = useAppState();
  const { showToast } = useToast();
  const [unread, setUnread] = useState(initialUnread);
  const [threads, setThreads] = useState<Record<string, Thread | undefined>>({});

  // what the stream's handlers read, which must not rebuild the stream
  const me = useRef(profile.id);
  const threadsRef = useRef(threads);
  const viewing = useRef(new Map<string, number>());
  const loading = useRef(new Set<string>());
  const lastRev = useRef<number | null>(null);
  const readTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    me.current = profile.id;
    threadsRef.current = threads;
  });

  const refreshUnread = useCallback(async () => {
    const result = await getChatUnreadAction().catch(() => null);
    if (!result?.ok) return;
    // a thread on screen is being read as it grows
    setUnread(Object.fromEntries(Object.entries(result.value).filter(([circleId]) => !viewing.current.has(circleId))));
  }, []);

  // read to the end of the thread, a moment after it last grew
  const markRead = useCallback((circleId: string) => {
    setUnread((u) => (u[circleId] ? { ...u, [circleId]: 0 } : u));
    clearTimeout(readTimers.current.get(circleId));
    readTimers.current.set(
      circleId,
      setTimeout(() => {
        const last = threadsRef.current[circleId]?.messages.at(-1);
        if (last) void markChatReadAction(circleId, last.id);
      }, READ_DEBOUNCE_MS),
    );
  }, []);

  const loadThread = useCallback(async (circleId: string) => {
    if (loading.current.has(circleId)) return;
    loading.current.add(circleId);
    try {
      const result = await getChatMessagesAction(circleId);
      if (!result.ok) {
        showToast({ tone: "error", message: result.error });
        return;
      }
      setThreads((t) => {
        // what the stream delivered while this was loading is newer
        const held = t[circleId]?.messages ?? [];
        return { ...t, [circleId]: { messages: held.reduce(upsert, result.value.messages), more: t[circleId]?.more ?? result.value.more } };
      });
    } finally {
      loading.current.delete(circleId);
    }
  }, [showToast]);

  const onMessage = useCallback(
    (m: ChatMessage) => {
      lastRev.current = Math.max(lastRev.current ?? 0, m.rev);
      const held = threadsRef.current[m.circleId];
      if (held) setThreads((t) => (t[m.circleId] ? { ...t, [m.circleId]: { ...t[m.circleId]!, messages: upsert(t[m.circleId]!.messages, m) } } : t));
      const onScreen = viewing.current.has(m.circleId) && document.visibilityState === "visible";
      if (onScreen) {
        if (m.authorId !== me.current && !m.deletedAt) markRead(m.circleId);
      } else if (m.authorId !== me.current && !m.deletedAt && !m.editedAt) {
        setUnread((u) => ({ ...u, [m.circleId]: (u[m.circleId] ?? 0) + 1 }));
      }
    },
    [markRead],
  );

  // the stream
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let opened = false;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    // after anything may have been missed, the threads on screen are read
    // afresh and the counts too, once the catch-up has come in
    function resync() {
      clearTimeout(settle);
      settle = setTimeout(() => {
        void refreshUnread();
        for (const circleId of Object.keys(threadsRef.current)) void loadThread(circleId);
      }, 1500);
    }

    function connect() {
      if (closed) return;
      source?.close();
      const since = lastRev.current;
      source = new EventSource(since !== null ? `/api/chat/stream?since=${since}` : "/api/chat/stream");
      source.addEventListener("open", () => {
        failures = 0;
        if (opened) resync();
        opened = true;
      });
      source.addEventListener("message", (e) => onMessage(JSON.parse((e as MessageEvent<string>).data) as ChatMessage));
      source.addEventListener("ready", (e) => {
        const rev = Number((e as MessageEvent<string>).lastEventId);
        if (Number.isFinite(rev) && lastRev.current === null) lastRev.current = rev;
      });
      source.addEventListener("resync", resync);
      source.addEventListener("error", () => {
        // the browser retries by itself unless it has given up
        if (source?.readyState !== EventSource.CLOSED) return;
        source = null;
        retry = setTimeout(connect, RECONNECT_MS[Math.min(failures++, RECONNECT_MS.length - 1)]);
      });
    }

    function comeBack() {
      if (document.visibilityState !== "visible") return;
      if (!source || source.readyState === EventSource.CLOSED) {
        clearTimeout(retry);
        connect();
      }
      void refreshUnread();
      for (const circleId of viewing.current.keys()) markRead(circleId);
    }

    connect();
    document.addEventListener("visibilitychange", comeBack);
    window.addEventListener("online", comeBack);
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(settle);
      source?.close();
      document.removeEventListener("visibilitychange", comeBack);
      window.removeEventListener("online", comeBack);
    };
  }, [onMessage, refreshUnread, loadThread, markRead]);

  const view = useCallback(
    (circleId: string) => {
      viewing.current.set(circleId, (viewing.current.get(circleId) ?? 0) + 1);
      if (threadsRef.current[circleId]) markRead(circleId);
      else void loadThread(circleId).then(() => markRead(circleId));
      return () => {
        const n = (viewing.current.get(circleId) ?? 1) - 1;
        if (n <= 0) viewing.current.delete(circleId);
        else viewing.current.set(circleId, n);
      };
    },
    [loadThread, markRead],
  );

  const loadEarlier = useCallback(
    async (circleId: string) => {
      const before = threadsRef.current[circleId]?.messages[0]?.id;
      if (before === undefined) return;
      const result = await getChatMessagesAction(circleId, before);
      if (!result.ok) return void showToast({ tone: "error", message: result.error });
      setThreads((t) => {
        const held = t[circleId];
        return held ? { ...t, [circleId]: { messages: result.value.messages.reduce(upsert, held.messages), more: result.value.more } } : t;
      });
    },
    [showToast],
  );

  // the server's copy goes into the thread at once; the stream brings the same again, a no-op
  const adopt = useCallback((m: ChatMessage) => {
    lastRev.current = Math.max(lastRev.current ?? 0, m.rev);
    setThreads((t) => (t[m.circleId] ? { ...t, [m.circleId]: { ...t[m.circleId]!, messages: upsert(t[m.circleId]!.messages, m) } } : t));
  }, []);

  const send = useCallback(
    async (circleId: string, body: string) => {
      const result = await sendChatMessageAction(circleId, { body, mentions: [] });
      if (!result.ok) return result.error;
      adopt(result.value);
      return null;
    },
    [adopt],
  );

  const edit = useCallback(
    async (id: number, body: string) => {
      const result = await editChatMessageAction(id, body);
      if (!result.ok) return result.error;
      adopt(result.value);
      return null;
    },
    [adopt],
  );

  const remove = useCallback(
    async (id: number) => {
      const result = await deleteChatMessageAction(id);
      if (!result.ok) return result.error;
      adopt(result.value);
      return null;
    },
    [adopt],
  );

  const value = useMemo(() => ({ unread, threads, view, loadEarlier, send, edit, remove }), [unread, threads, view, loadEarlier, send, edit, remove]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
