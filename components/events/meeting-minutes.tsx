"use client";

import { AgendaBadge } from "./agenda-section";
import { Eyebrow } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { useMemberById } from "@/lib/hooks";
import { localDay } from "@/lib/recurrence.util";
import { dueCell } from "@/lib/tasks.util";
import { messageHtml, messageWhen } from "@/lib/messages.util";
import type { MeetingSession } from "@/lib/types";

/* A meeting's minutes: each topic as it was on the agenda with what was
   written about it, and who last edited them and when. */
export function MeetingMinutes({ session }: { session: MeetingSession }) {
  const memberById = useMemberById();
  const editor = session.minutesEditedBy !== undefined ? memberById(session.minutesEditedBy) : undefined;
  return (
    <div>
      <ol className="m-0 flex list-none flex-col gap-6 p-0">
        {session.topics.map((t) => (
          <li key={t.position} className="border-t-[3px] border-t-agenda pt-3">
            <div className="flex items-center gap-2">
              <AgendaBadge category={t.category} />
              <Eyebrow className="text-agenda">{AGENDA_CATEGORY[t.category].label}</Eyebrow>
            </div>
            <div className="mt-2 font-sans text-base leading-tight font-bold wrap-anywhere">{t.title}</div>
            {t.notes.trim() ? (
              <div className="message-text mt-2 font-serif text-base leading-normal text-body" dangerouslySetInnerHTML={{ __html: messageHtml(t.notes) }} />
            ) : (
              <p className="mt-2 font-serif text-base text-soft">Nothing written.</p>
            )}
          </li>
        ))}
      </ol>
      {session.tasks.length > 0 && (
        <div className="mt-8 border-t-[3px] border-t-ink pt-3">
          <Eyebrow className="text-soft">Tasks</Eyebrow>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {session.tasks.map((t) => {
              const who = t.assigneeId !== undefined ? memberById(t.assigneeId) : undefined;
              const due = dueCell(t, localDay());
              return (
                <li key={t.id} className="font-serif text-base wrap-anywhere">
                  <span className="font-sans font-bold">{t.title}</span>
                  <span className="text-soft">
                    {who ? ` · ${who.name}` : ""}
                    {due ? ` · ${due.text}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {session.minutesEditedAt && (
        <p className="mt-6 font-sans text-xs font-bold tracking-open text-soft">
          Last edited{editor ? ` by ${editor.name}` : ""} {messageWhen(session.minutesEditedAt)}
        </p>
      )}
    </div>
  );
}
