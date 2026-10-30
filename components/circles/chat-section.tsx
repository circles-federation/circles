"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { EllipsisHorizontalIcon, HandRaisedIcon, PaperAirplaneIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useChat } from "@/components/providers/chat-provider";
import { useAppState } from "@/components/providers/app-state-provider";
import { Avatar, Button, ConfirmModal, EmptyState, TextArea, useToast } from "@/components/shared";
import { GhostIconButton } from "@/components/shared/ghost-icon-button";
import { IconButtonCircle } from "@/components/shared/icon-button-circle";
import { canEditChat, highlightMentions, matchMentions, mentionAt, mentionsIn, type MentionTarget } from "@/lib/chat.util";
import { useClock, useMemberById, useMembers } from "@/lib/hooks";
import { messageHtml, messageWhen } from "@/lib/messages.util";
import type { ChatMessage, Circle, Member } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";

// for useSyncExternalStore reading something that never changes once there's a browser
const subscribeNothing = () => () => {};

// a run of one person's messages shows their name and photo once, unless a gap this long falls in it
const RUN_GAP_MS = 5 * 60_000;

const LINK_BUTTON = "hit cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-bold tracking-caps text-soft uppercase underline hover:text-ink";

/* A circle's chat thread, for its members (components/providers/
   chat-provider.tsx keeps it live): oldest at the top, the composer fixed to
   the foot of the screen (the bottom nav is away on this page, hidesBottomNav,
   for the room). Opening it
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

  useEffect(() => view(circle.id), [view, circle.id]);

  /* The thread opens at its newest message and stays there: pinned to the
     end until the reader scrolls up, and again once they're back near it.
     Anything that makes the page taller while pinned (a message arriving, a
     photo loading, the composer growing) is followed down, and for the first
     moments after opening it's put back repeatedly, since the page resets
     its own scroll as it arrives. Sending always returns to the end. Whichever
     of the document or <main> scrolls, the end marker is scrolled into view. */
  const root = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = root.current;
    const end = endRef.current;
    if (!el || !end) return;
    const openedAt = Date.now();
    let moving = 0;
    const toEnd = () => {
      // our own scrolling mustn't be taken for the reader leaving
      moving = Date.now() + 500;
      end.scrollIntoView({ block: "end", behavior: Date.now() - openedAt < 1500 ? "auto" : "smooth" });
    };
    const nearEnd = () => end.getBoundingClientRect().top <= window.innerHeight + 120;
    const onScroll = () => {
      if (Date.now() > moving) pinned.current = nearEnd();
    };
    const follow = new ResizeObserver(() => pinned.current && toEnd());
    follow.observe(el);
    const settle = [0, 100, 300, 800].map((ms) => setTimeout(() => pinned.current && toEnd(), ms));
    window.addEventListener("scroll", onScroll, true);
    return () => {
      follow.disconnect();
      settle.forEach(clearTimeout);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // the message whose actions are showing, if any: tapping a bubble opens them, and
  // a tap anywhere else or Escape puts them away
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    if (selectedId === null) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(`[data-chat-message="${selectedId}"]`)) setSelectedId(null);
    };
    const escape = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [selectedId]);

  const [earlierBusy, setEarlierBusy] = useState(false);
  // how tall the composer is, which is fixed over the foot of the screen, so the
  // end of the thread stops above it
  const [composerHeight, setComposerHeight] = useState(76);

  return (
    // -mb-20 takes back the page container's bottom padding, which would leave a gap
    // between the last message and the composer
    <div ref={root} className="-mb-20">
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
                const next = messages[i + 1];
                const within = (a: ChatMessage, b: ChatMessage) => a.authorId === b.authorId && new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() < RUN_GAP_MS;
                const author = m.authorId !== undefined ? memberById(m.authorId) : undefined;
                return (
                  <ChatRow
                    key={m.id}
                    message={m}
                    circleName={circle.name}
                    authorName={author?.name ?? "Former member"}
                    avatar={author ? <Avatar member={author} size={36} /> : <span className="size-9 shrink-0 border border-ink bg-faint" />}
                    continued={!!prev && within(prev, m)}
                    endsRun={!next || !within(m, next)}
                    mine={m.authorId === profile.id}
                    mentioned={m.mentions.flatMap((id) => memberById(id)?.name ?? [])}
                    selected={selectedId === m.id}
                    onSelect={(open) => setSelectedId(open ? m.id : null)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <Composer circleName={circle.name} people={people} onSend={(body, mentions) => {
          // your own message always takes you to the end
          pinned.current = true;
          return send(circle.id, body, mentions);
        }} onHeight={setComposerHeight} />
      <div aria-hidden style={{ height: composerHeight }} />
      <div ref={endRef} />
    </div>
  );
}

interface ChatRowProps {
  message: ChatMessage;
  circleName: string;
  authorName: string;
  avatar: ReactNode;
  // the same person's message follows on from the one before it, so it carries
  // no name or photo of its own
  continued: boolean;
  // and the next one is someone else's, or much later
  endsRun: boolean;
  mine: boolean;
  mentioned: string[];
  selected: boolean;
  onSelect: (open: boolean) => void;
}

// what each action in the tray under a bubble looks like
const TRAY_BUTTON = "hit flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-xs font-bold tracking-caps uppercase";

/* One message, as a chat bubble: round on every corner but the one by its
   author, light grey from other people and blue from you, yours on the right.
   A run of one person's messages shows their photo and name once, and yours
   its time once, under the last. Nothing else is drawn on a message: a tap on
   a bubble (or the ellipsis that appears beside it where there's a pointer)
   opens a small tray of what can be done to it, and a tap elsewhere puts it
   away. You can edit yours for a while and delete it at any time; anyone
   else's can be proposed for removal. */
function ChatRow({ message: m, circleName, authorName, avatar, continued, endsRun, mine, mentioned, selected, onSelect }: ChatRowProps) {
  const { edit, remove } = useChat();
  const { proposals, proposeMessageRemoval } = useAppState();
  const router = useRouter();
  const { showToast } = useToast();
  const now = useClock();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [proposingRemoval, setProposingRemoval] = useState(false);
  // a message under review is hidden until asked for
  const [revealed, setRevealed] = useState(false);
  const underReview = !!m.reviewProposalId && !m.deletedAt;
  const reviewKnown = !!m.reviewProposalId && proposals.some((p) => p.id === m.reviewProposalId);
  const canEdit = mine && !m.deletedAt && !underReview && now !== null && canEditChat(m.createdAt, now);
  const canDelete = mine && !m.deletedAt;
  const canPropose = !mine && !m.deletedAt && !underReview;
  const hasActions = canEdit || canDelete || canPropose;
  const when = now !== null ? messageWhen(m.createdAt, new Date(now)) : "";

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

  async function proposeRemoval() {
    setProposingRemoval(false);
    const result = await proposeMessageRemoval(m.id);
    if (!result.ok) return showToast({ tone: "error", message: result.error });
    router.push(`/proposals/${result.proposalId}`);
  }

  // a tap on the bubble opens its actions, unless it was a link, or the start of selecting its text
  function tapBubble(e: MouseEvent) {
    if (!hasActions || (e.target instanceof Element && e.target.closest("a")) || window.getSelection()?.toString()) return;
    onSelect(!selected);
  }

  const bubble = clsx("w-fit max-w-full rounded-bubble px-4 py-2.5 wrap-break-word", mine ? "rounded-br-none" : "rounded-bl-none");

  // what is said, or why it isn't
  let content: ReactNode;
  if (m.deletedAt) {
    content = <p className={clsx(bubble, "m-0 border border-dashed border-faint font-serif text-sm text-soft italic")}>Message deleted</p>;
  } else if (editing !== null) {
    content = (
      <div className="w-72 max-w-full min-[720px]:w-120">
        <TextArea
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(null);
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          }}
          rows={3}
          autoFocus
        />
        <div className={clsx("mt-2 flex gap-2", mine && "justify-end")}>
          <Button variant="secondary" size="compact" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button size="compact" disabled={busy || !editing.trim() || editing.trim() === m.body} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    );
  } else if (underReview && !revealed) {
    content = (
      <div onClick={tapBubble} className={clsx(bubble, "border border-flame bg-paper", hasActions && "cursor-pointer")}>
        <div className="font-sans text-label font-bold tracking-caps text-flame uppercase">Under review</div>
        <p className="m-0 mt-0.5 font-serif text-sm leading-snug text-body">{circleName}&rsquo;s members are deciding whether to remove this message.</p>
        <div className="mt-1 flex items-center gap-3">
          <button type="button" className={LINK_BUTTON} onClick={() => setRevealed(true)}>
            Show
          </button>
          {reviewKnown && (
            <Link href={`/proposals/${m.reviewProposalId}`} className={LINK_BUTTON}>
              View proposal
            </Link>
          )}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="group/row relative max-w-full">
        <div
          onClick={tapBubble}
          className={clsx(
            bubble,
            "font-serif text-base leading-snug transition-[filter] duration-(--motion-small)",
            mine ? "chat-bubble-mine bg-teal text-paper" : "bg-wash text-body",
            hasActions && "cursor-pointer",
            selected && "brightness-95",
            underReview && "opacity-60",
          )}
        >
          <div className="message-text" dangerouslySetInnerHTML={{ __html: highlightMentions(messageHtml(m.body), mentioned) }} />
        </div>
        {/* where there's a pointer, the way in is shown on hover; a touch screen just taps the bubble */}
        {hasActions && !selected && (
          <GhostIconButton
            icon={EllipsisHorizontalIcon}
            label="Message actions"
            onClick={() => onSelect(true)}
            className={clsx("absolute top-1/2 -translate-y-1/2 text-soft opacity-0 transition-opacity duration-(--motion-small) group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden", mine ? "right-full" : "left-full")}
          />
        )}
      </div>
    );
  }

  const caption = [m.editedAt && !m.deletedAt && "Edited", mine && endsRun && when].filter(Boolean).join(" · ");

  return (
    <div className={clsx("flex gap-2", mine && "justify-end", continued ? "pt-0.5" : "pt-4")}>
      {!mine && <div className="w-9 shrink-0">{!continued && avatar}</div>}
      <div data-chat-message={m.id} className={clsx("flex min-w-0 max-w-[85%] flex-col min-[720px]:max-w-136", mine ? "items-end" : "items-start")}>
        {!continued && !mine && (
          <div className="mb-1 flex items-baseline gap-2">
            <span className="truncate font-sans text-base font-extrabold tracking-snug">{authorName}</span>
            {/* the browser's own time and day, so not drawn on the server */}
            {now !== null && <span className="shrink-0 font-serif text-sm text-soft" title={new Date(m.createdAt).toLocaleString()}>{when}</span>}
          </div>
        )}
        {content}

        {selected && hasActions && (
          <div className={clsx("mt-1 flex items-center gap-4 px-1 animate-tray-in", mine && "flex-row-reverse")}>
            {canEdit && (
              <button type="button" className={clsx(TRAY_BUTTON, "text-body hover:text-ink")} onClick={() => { onSelect(false); setEditing(m.body); }}>
                <PencilIcon className="size-4" strokeWidth={2} aria-hidden />
                Edit
              </button>
            )}
            {canDelete && (
              <button type="button" className={clsx(TRAY_BUTTON, "text-danger")} onClick={() => { onSelect(false); setConfirmingDelete(true); }}>
                <TrashIcon className="size-4" strokeWidth={2} aria-hidden />
                Delete
              </button>
            )}
            {canPropose && (
              <button type="button" className={clsx(TRAY_BUTTON, "text-flame")} onClick={() => { onSelect(false); setProposingRemoval(true); }}>
                <HandRaisedIcon className="size-4" strokeWidth={2} aria-hidden />
                Propose removal
              </button>
            )}
          </div>
        )}

        {(caption || (underReview && revealed)) && (
          <div className="mt-1 flex items-center gap-3 px-1 font-serif text-sm text-soft">
            {caption && <span>{caption}</span>}
            {underReview && revealed && (
              <>
                <button type="button" className={LINK_BUTTON} onClick={() => setRevealed(false)}>
                  Hide
                </button>
                {reviewKnown && (
                  <Link href={`/proposals/${m.reviewProposalId}`} className={LINK_BUTTON}>
                    View proposal
                  </Link>
                )}
              </>
            )}
          </div>
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

function Composer({ circleName, people, onSend, onHeight }: { circleName: string; people: Member[]; onSend: (body: string, mentions: number[]) => Promise<string | null>; onHeight: (px: number) => void }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // the row of field and button, which the list of members is laid against
  const row = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  // laid on the page itself, not inside it: a page's content animates in, and
  // anything fixed inside an animating ancestor stops being fixed to the screen
  const host = useSyncExternalStore(subscribeNothing, () => document.body, () => null);
  // how far the on-screen keyboard covers the foot of the layout viewport (the
  // browser lifts a field above it only on some platforms), so the bar rides on it
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(viewport.scale > 1.01 ? 0 : Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    const el = bar.current;
    if (!host || !el) return;
    const observer = new ResizeObserver(() => onHeight(el.offsetHeight));
    observer.observe(el);
    onHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, [host, onHeight]);
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
    const el = row.current;
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

  if (!host) return null;
  return createPortal(
    // a bar fixed to the foot of the screen, on paper with a hairline above it
    // like the top bar's tab row, level with the page's column; over the foot
    // of the page but under the top bar
    <div
      ref={bar}
      style={{ bottom: inset }}
      className="fixed inset-x-0 z-40 border-t border-faint bg-paper pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
    >
      <form onSubmit={submit} className={clsx("mx-auto max-w-220 px-6 pt-3", inset > 0 ? "pb-3" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
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
        <div ref={row} className="flex items-end gap-2">
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
            className="max-h-40 min-h-11 resize-none! py-2.5"
          />
          {/* the same blue circle as the top bar's primary action, faint until there's something to send */}
          <button type="submit" aria-label="Send" disabled={busy || !draft.trim()} className="group flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-not-allowed">
            <IconButtonCircle icon={PaperAirplaneIcon} variant="primary" />
          </button>
        </div>
        {error && <p className="m-0 mt-2 font-serif text-sm text-danger">{error}</p>}
      </form>
    </div>,
    host,
  );
}
