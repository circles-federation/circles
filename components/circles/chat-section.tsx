"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useChat } from "@/components/providers/chat-provider";
import { useAppState } from "@/components/providers/app-state-provider";
import { Avatar, Button, ConfirmModal, EmptyState, TextArea, useToast } from "@/components/shared";
import { canEditChat, highlightMentions, matchMentions, mentionAt, mentionsIn, type MentionTarget } from "@/lib/chat.util";
import { useClock, useMemberById, useMembers } from "@/lib/hooks";
import { messageHtml, messageWhen } from "@/lib/messages.util";
import type { ChatMessage, Circle, Member } from "@/lib/types";
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
   no Shift. Typing @ offers the circle's members: those tagged are the only
   ones notified of the message, and anyone untagged still reads it here. Your own messages can be edited for a while and deleted at any
   time. Anyone else's can be proposed for removal, which the circle's members
   decide by consent: until they do, the message is collapsed for everyone as
   under review, and a tap still shows it. */
export function ChatSection({ circle }: { circle: Circle }) {
  const { threads, view, loadEarlier, send } = useChat();
  const { profile } = useAppState();
  const memberById = useMemberById();
  const allMembers = useMembers();
  const people = allMembers.filter((m) => m.id !== profile.id && circle.members.includes(m.id));
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
                return <ChatRow key={m.id} message={m} circleName={circle.name} authorName={author?.name ?? "Former member"} avatar={author ? <Avatar member={author} size={36} /> : <span className="size-9 shrink-0 border border-ink bg-faint" />} continued={!!run} mine={m.authorId === profile.id} mentioned={m.mentions.flatMap((id) => memberById(id)?.name ?? [])} />;
              })}
            </div>
          )}
        </>
      )}

      <Composer circleName={circle.name} people={people} onSend={(body, mentions) => send(circle.id, body, mentions)} />
      <div ref={endRef} />
    </div>
  );
}

function ChatRow({ message: m, circleName, authorName, avatar, continued, mine, mentioned }: { message: ChatMessage; circleName: string; authorName: string; avatar: React.ReactNode; continued: boolean; mine: boolean; mentioned: string[] }) {
  const { edit, remove } = useChat();
  const { proposals, proposeMessageRemoval } = useAppState();
  const router = useRouter();
  const { showToast } = useToast();
  const now = useClock();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [proposingRemoval, setProposingRemoval] = useState(false);
  // the message of a proposal to remove it is hidden until asked for
  const [revealed, setRevealed] = useState(false);
  const underReview = !!m.reviewProposalId && !m.deletedAt;
  const reviewKnown = !!m.reviewProposalId && proposals.some((p) => p.id === m.reviewProposalId);
  const canEdit = mine && !m.deletedAt && !underReview && now !== null && canEditChat(m.createdAt, now);

  async function proposeRemoval() {
    setProposingRemoval(false);
    const result = await proposeMessageRemoval(m.id);
    if (!result.ok) return showToast({ tone: "error", message: result.error });
    router.push(`/proposals/${result.proposalId}`);
  }

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
        ) : underReview && !revealed ? (
          <div className="mt-1 border-l-4 border-l-flame bg-wash px-3 py-2">
            <p className="m-0 font-serif text-sm leading-snug text-body">Under review. {circleName}&rsquo;s members are deciding whether to remove this message.</p>
            <div className="mt-1 flex items-center gap-3">
              <button type="button" className={LINK_BUTTON} onClick={() => setRevealed(true)}>
                Show
              </button>
              {reviewKnown && (
                <Link href={`/proposals/${m.reviewProposalId}`} className={LINK_BUTTON}>
                  View proposal
                </Link>
              )}
              {mine && (
                <button type="button" className={LINK_BUTTON} onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className={clsx("message-text font-serif text-base leading-normal text-body wrap-break-word", underReview && "opacity-60")} dangerouslySetInnerHTML={{ __html: highlightMentions(messageHtml(m.body), mentioned) }} />
            <div className="flex items-center gap-3">
              {underReview && (
                <button type="button" className={LINK_BUTTON} onClick={() => setRevealed(false)}>
                  Hide
                </button>
              )}
              {underReview && reviewKnown && (
                <Link href={`/proposals/${m.reviewProposalId}`} className={LINK_BUTTON}>
                  View proposal
                </Link>
              )}
              {!mine && !m.deletedAt && !underReview && (
                <button type="button" className={LINK_BUTTON} onClick={() => setProposingRemoval(true)}>
                  Remove
                </button>
              )}
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
      {proposingRemoval && (
        <ConfirmModal
          tone="flame"
          title="Propose removing this message?"
          message={`${circleName}'s members decide by consent. Until they do, it's collapsed for everyone as under review. If no one objects within 3 days, it's removed.`}
          confirmLabel="Propose"
          cancelLabel="Cancel"
          onConfirm={proposeRemoval}
          onCancel={() => setProposingRemoval(false)}
        />
      )}
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

function Composer({ circleName, people, onSend }: { circleName: string; people: Member[]; onSend: (body: string, mentions: number[]) => Promise<string | null> }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // who has been picked from the list, and the @word being typed now
  const picked = useRef<MentionTarget[]>([]);
  const [typing, setTyping] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const choices = typing ? matchMentions(people, typing.query) : [];
  const listOpen = choices.length > 0;

  // as tall as what's typed, up to a few lines
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  /* The list is laid on the page, above the bars, rather than inside the
     composer, which sits under them whenever the thread is short: over or
     under the composer, whichever has more room, and no taller than that. */
  const [place, setPlace] = useState<{ left: number; width: number; maxHeight: number; top?: number; bottom?: number } | null>(null);
  useLayoutEffect(() => {
    const el = form.current;
    if (!listOpen || !el) return setPlace(null);
    function measure() {
      const rect = el!.getBoundingClientRect();
      const vv = window.visualViewport;
      const barHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-bar-height")) || 0;
      const above = rect.top - Math.max(barHeight, 0) - 8;
      const below = (vv ? vv.offsetTop + vv.height : window.innerHeight) - rect.bottom - 8;
      const up = above >= below || above >= 240;
      setPlace(
        up
          ? { left: rect.left, width: rect.width, maxHeight: Math.max(above, 96), bottom: window.innerHeight - rect.top }
          : { left: rect.left, width: rect.width, maxHeight: Math.max(below, 96), top: rect.bottom },
      );
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [listOpen]);

  function watchCaret(text: string, caret: number) {
    setTyping(mentionAt(text, caret));
    setActive(0);
  }

  function pick(person: Member) {
    const el = field.current;
    if (!el || !typing) return;
    const caret = el.selectionStart;
    const next = `${draft.slice(0, typing.start)}@${person.name} ${draft.slice(caret)}`;
    picked.current = [...picked.current.filter((p) => p.id !== person.id), { id: person.id, name: person.name }];
    setDraft(next);
    setTyping(null);
    // the caret goes after the name once the field has what was inserted
    const at = typing.start + person.name.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError(null);
    const problem = await onSend(draft, mentionsIn(draft, picked.current));
    setBusy(false);
    if (problem) return setError(problem);
    setDraft("");
    picked.current = [];
    setTyping(null);
    field.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (listOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const person = choices[active];
        if (person) pick(person);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTyping(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isPhoneWidth()) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form
      ref={form}
      onSubmit={submit}
      // pinned over the end of the thread, above the bottom nav on a phone
      className="sticky bottom-[calc(var(--bottom-nav-gap)+4.75rem)] z-10 mt-4 border-t border-faint bg-paper py-3 min-[720px]:bottom-0"
    >
      {listOpen &&
        place &&
        createPortal(
          // a press on the list mustn't take focus from the field, or the list closes before the tap lands
          <ul
            role="listbox"
            aria-label="Members to tag"
            onMouseDown={(e) => e.preventDefault()}
            style={{ left: place.left, width: place.width, maxHeight: place.maxHeight, top: place.top, bottom: place.bottom }}
            className="fixed z-60 m-0 list-none overflow-y-auto bg-raised p-0 shadow-overlay"
          >
            {choices.map((person, i) => (
              <li key={person.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => pick(person)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx("flex w-full cursor-pointer items-center gap-3 border-0 border-b border-faint px-4 py-3 text-left text-ink last:border-b-0", i === active ? "bg-wash" : "bg-transparent")}
                >
                  <Avatar member={person} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-base font-bold tracking-snug">{person.name}</span>
                    {person.role && <span className="block truncate font-serif text-sm text-soft">{person.role}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
      <div className="flex items-end gap-2">
        <TextArea
          ref={field}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            watchCaret(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") watchCaret(draft, e.currentTarget.selectionStart);
          }}
          onClick={(e) => watchCaret(draft, e.currentTarget.selectionStart)}
          onBlur={() => setTyping(null)}
          placeholder={`Message ${circleName}`}
          aria-label={`Message ${circleName}`}
          aria-autocomplete="list"
          className="max-h-40 min-h-12 resize-none!"
        />
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
