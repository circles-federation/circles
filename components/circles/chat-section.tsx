"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useChat } from "@/components/providers/chat-provider";
import { useAppState } from "@/components/providers/app-state-provider";
import { Avatar, Button, ConfirmModal, EmptyState, TextArea, useToast } from "@/components/shared";
import { canEditChat } from "@/lib/chat.util";
import { useClock, useMemberById } from "@/lib/hooks";
import { messageHtml, messageWhen } from "@/lib/messages.util";
import type { ChatMessage, Circle } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";

// a run of one person's messages shows their name and photo once, unless a gap this long falls in it
const RUN_GAP_MS = 5 * 60_000;

const LINK_BUTTON = "hit cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-bold tracking-caps text-soft uppercase underline hover:text-ink";

/* A circle's chat thread, for its members (components/providers/
   chat-provider.tsx keeps it live): oldest at the top, the composer pinned at
   the foot of the screen, clear of the bottom nav on a phone. Opening it
   reads it. It follows the thread down as messages arrive, but only while
   the reader is already at the end of it, so reading back isn't interrupted.
   Enter sends on a computer, and starts a new line on a phone, where there's
   no Shift. Your own messages can be edited for a while and deleted at any
   time. */
export function ChatSection({ circle }: { circle: Circle }) {
  const { threads, view, loadEarlier, send } = useChat();
  const { profile } = useAppState();
  const memberById = useMemberById();
  const thread = threads[circle.id];
  const messages = thread?.messages ?? [];
  const last = messages.at(-1);

  useEffect(() => view(circle.id), [view, circle.id]);

  // follow the thread down while the reader is at its end
  const endRef = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const shownLast = useRef<number | null>(null);
  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const observer = new IntersectionObserver(([entry]) => void (atEnd.current = entry?.isIntersecting ?? true), { rootMargin: "0px 0px 160px 0px" });
    observer.observe(end);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!last) return;
    const first = shownLast.current === null;
    if (first || atEnd.current || last.authorId === profile.id) endRef.current?.scrollIntoView({ block: "end", behavior: first ? "auto" : "smooth" });
    shownLast.current = last.id;
  }, [last, profile.id]);

  const [earlierBusy, setEarlierBusy] = useState(false);

  return (
    <div>
      {thread === undefined ? (
        <p className="font-serif text-base text-soft">Loading the conversation…</p>
      ) : (
        <>
          {thread.more && (
            <div className="mb-4">
              <Button
                variant="secondary"
                size="compact"
                disabled={earlierBusy}
                onClick={async () => {
                  setEarlierBusy(true);
                  await loadEarlier(circle.id);
                  setEarlierBusy(false);
                }}
              >
                Earlier messages
              </Button>
            </div>
          )}
          {messages.length === 0 ? (
            <EmptyState>Nothing said yet. Whatever you write here goes to everyone in {circle.name}, unless you tag people.</EmptyState>
          ) : (
            <div>
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const run = prev && prev.authorId === m.authorId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < RUN_GAP_MS;
                const author = m.authorId !== undefined ? memberById(m.authorId) : undefined;
                return <ChatRow key={m.id} message={m} circleName={circle.name} authorName={author?.name ?? "Former member"} avatar={author ? <Avatar member={author} size={36} /> : <span className="size-9 shrink-0 border border-ink bg-faint" />} continued={!!run} mine={m.authorId === profile.id} />;
              })}
            </div>
          )}
        </>
      )}

      <Composer circleName={circle.name} onSend={(body) => send(circle.id, body)} />
      <div ref={endRef} />
    </div>
  );
}

function ChatRow({ message: m, circleName, authorName, avatar, continued, mine }: { message: ChatMessage; circleName: string; authorName: string; avatar: React.ReactNode; continued: boolean; mine: boolean }) {
  const { edit, remove } = useChat();
  const { showToast } = useToast();
  const now = useClock();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canEdit = mine && !m.deletedAt && now !== null && canEditChat(m.createdAt, now);

  async function save() {
    if (editing === null) return;
    setBusy(true);
    const error = await edit(m.id, editing);
    setBusy(false);
    if (error) showToast({ tone: "error", message: error });
    else setEditing(null);
  }

  async function confirmDelete() {
    setConfirmingDelete(false);
    const error = await remove(m.id);
    if (error) showToast({ tone: "error", message: error });
  }

  return (
    <div className={clsx("flex gap-2", continued ? "pt-1" : "pt-4")}>
      <div className="w-9 shrink-0">{!continued && avatar}</div>
      <div className="min-w-0 flex-1">
        {!continued && (
          <div className="flex items-baseline gap-2">
            <span className="truncate font-sans text-base font-extrabold tracking-snug">{authorName}</span>
            {/* the browser's own time and day, so not drawn on the server */}
            {now !== null && <span className="shrink-0 font-serif text-sm text-soft" title={new Date(m.createdAt).toLocaleString()}>{messageWhen(m.createdAt, new Date(now))}</span>}
          </div>
        )}
        {m.deletedAt ? (
          <p className="m-0 font-serif text-base text-soft italic">Message deleted</p>
        ) : editing !== null ? (
          <div className="mt-1">
            <TextArea value={editing} onChange={(e) => setEditing(e.target.value)} rows={3} autoFocus />
            <div className="mt-2 flex gap-2">
              <Button size="compact" disabled={busy || !editing.trim() || editing.trim() === m.body} onClick={save}>
                Save
              </Button>
              <Button variant="secondary" size="compact" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="message-text font-serif text-base leading-normal text-body wrap-break-word" dangerouslySetInnerHTML={{ __html: messageHtml(m.body) }} />
            <div className="flex items-center gap-3">
              {m.editedAt && <span className="font-sans text-label tracking-caps text-soft uppercase">Edited</span>}
              {canEdit && (
                <button type="button" className={LINK_BUTTON} onClick={() => setEditing(m.body)}>
                  Edit
                </button>
              )}
              {mine && (
                <button type="button" className={LINK_BUTTON} onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {confirmingDelete && (
        <ConfirmModal
          title="Delete this message?"
          message={`It disappears for everyone in ${circleName}. This can't be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function Composer({ circleName, onSend }: { circleName: string; onSend: (body: string) => Promise<string | null> }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // as tall as what's typed, up to a few lines
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError(null);
    const problem = await onSend(draft);
    setBusy(false);
    if (problem) return setError(problem);
    setDraft("");
    field.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isPhoneWidth()) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      // pinned over the end of the thread, above the bottom nav on a phone
      className="sticky bottom-[calc(var(--bottom-nav-gap)+4.75rem)] z-10 mt-4 border-t border-faint bg-paper py-3 min-[720px]:bottom-0"
    >
      <div className="flex items-end gap-2">
        <TextArea ref={field} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder={`Message ${circleName}`} aria-label={`Message ${circleName}`} className="max-h-40 min-h-12 resize-none!" />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || !draft.trim()}
          className="btn-invert btn-ink flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink bg-ink text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PaperAirplaneIcon className="size-5" />
        </button>
      </div>
      {error && <p className="m-0 mt-2 font-serif text-sm text-danger">{error}</p>}
    </form>
  );
}
