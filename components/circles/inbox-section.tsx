"use client";

import Link from "next/link";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, EmptyState } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useClock, useHistoryState, useMemberById } from "@/lib/hooks";
import { messageText, messageWhen } from "@/lib/messages.util";
import type { Circle } from "@/lib/types";

/* A circle's Inbox, for its members: what's been written to it from its
   wiki, newest first, as Open (what's still to deal with) or Done (filed
   away). Each is a row like an envelope: who wrote, the subject and a line
   of it, when, and who's handling it once someone is; one the viewer hasn't
   opened is set in bold with a dot. A row opens the message. Which list is
   showing is kept on the history entry, so Back returns to it. */
export function InboxSection({ circle }: { circle: Circle }) {
  const { messages, profile } = useAppState();
  const memberById = useMemberById();
  const now = useClock();
  const [list, setList] = useHistoryState<"open" | "done">(`inbox-${circle.id}`, "open");
  const mine = messages.filter((m) => m.circleId === circle.id);
  const open = mine.filter((m) => !m.doneAt);
  const shown = list === "open" ? open : mine.filter((m) => m.doneAt);

  return (
    <div>
      <div className="mb-4 flex gap-5" role="tablist" aria-label="Messages">
        {(["open", "done"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={list === key}
            onClick={() => setList(key)}
            className={clsx(
              "hit cursor-pointer border-0 border-b-2 bg-transparent px-0 pb-1.5 font-sans text-xs font-bold tracking-caps uppercase",
              list === key ? "border-b-ink text-ink" : "border-b-transparent text-soft hover:text-ink",
            )}
          >
            {key === "open" ? `Open${open.length > 0 ? ` · ${open.length}` : ""}` : "Done"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState>{list === "open" ? `Nothing to answer. People write to ${circle.name} from its Wiki, and it arrives here.` : "Nothing filed as done yet."}</EmptyState>
      ) : (
        <div className="border-t border-ink">
          {shown.map((m) => {
            const sender = m.senderId !== undefined ? memberById(m.senderId) : undefined;
            const handler = m.assigneeId !== undefined ? memberById(m.assigneeId) : undefined;
            return (
              <Link key={m.id} href={`/circles/${circle.id}/inbox/${m.id}`} className="relative flex gap-3 border-b border-faint py-4 pr-1 text-ink no-underline last:border-b-ink">
                {!m.read && <span aria-label="New" className="absolute top-1/2 -left-3.5 size-2 -translate-y-1/2 rounded-full bg-action" />}
                {sender ? <Avatar member={sender} size={44} /> : <span className="size-11 shrink-0 border border-ink bg-faint" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={clsx("truncate font-sans text-base", m.read ? "font-semibold text-body" : "font-extrabold")}>{m.senderName}</span>
                    {/* the browser's own time and day, so not drawn on the server */}
                    <span className="shrink-0 font-serif text-sm text-soft">{now !== null && messageWhen(m.createdAt, new Date(now))}</span>
                  </span>
                  <span className={clsx("mt-0.5 block truncate font-sans text-base", m.read ? "font-semibold text-body" : "font-bold")}>{m.subject}</span>
                  <span className="mt-0.5 block truncate font-serif text-sm text-soft">{messageText(m.body).replace(/\s+/g, " ")}</span>
                  {handler && (
                    <span className="mt-1.5 flex items-center gap-1.5 font-sans text-sm text-teal">
                      <UserCircleIcon className="size-4" strokeWidth={2} aria-hidden />
                      {handler.id === profile.id ? "You're handling it" : `${handler.name} is handling it`}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
