"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { AgendaBadge } from "./agenda-section";
import { ATTENDEE_CARD, ATTENDEE_GRID, AttendeeCardContent } from "./attendee-card";
import { GuestAvatar } from "./guest-avatar";
import { MeetingTaskTable } from "./meeting-task-table";
import { Avatar, Badge, Eyebrow } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { useClock, useMemberById } from "@/lib/hooks";
import { messageHtml, messageWhen } from "@/lib/messages.util";
import type { Circle, Event, Member, MeetingSession } from "@/lib/types";

const minutesText = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}`);

const SECTION = "mt-10";

/* The last step, under the stepper's "Finish": a summary card with the
   meeting at a glance (how long, who was here, how many topics have notes, how
   many tasks), then who was here on the same cards as Attendance, what was
   written on each topic (the ones nothing was written on folded into one line
   rather than listed empty), and the tasks in the circle's own table. The
   facilitator's Finish is the top bar's. */
export function MeetingWrapupStep({ session, event: e, circle, facilitating }: { session: MeetingSession; event: Event; circle: Circle; facilitating: boolean }) {
  const router = useRouter();
  const memberById = useMemberById();
  const now = useClock();
  const people = session.attendees.map((id) => memberById(id)).filter((m): m is Member => !!m);
  const here = people.length + session.guests.length;
  const written = session.topics.filter((t) => t.notes.trim());
  const unwritten = session.topics.filter((t) => !t.notes.trim());
  const elapsed = now ? Math.max(0, Math.round((now - new Date(session.startedAt).getTime()) / 60_000)) : null;
  const stats: { value: string; label: string }[] = [
    { value: String(here), label: here === 1 ? "person here" : "people here" },
    { value: `${written.length}/${session.topics.length}`, label: session.topics.length === 1 ? "topic with notes" : "topics with notes" },
    { value: String(session.tasks.length), label: session.tasks.length === 1 ? "task" : "tasks" },
  ];

  return (
    <div>
      <section className="border border-ink bg-wash p-5">
        <Eyebrow>Summary</Eyebrow>
        <h2 className="mt-2 font-sans text-xl leading-tight font-extrabold tracking-heading wrap-anywhere">{e.title}</h2>
        <p className="mt-1 mb-0 font-serif text-sm text-soft">
          Started {messageWhen(session.startedAt)}
          {elapsed !== null && ` · ${minutesText(elapsed)} so far`}
        </p>
        <ul className="m-0 mt-5 grid list-none grid-cols-3 gap-3 p-0">
          {stats.map((s) => (
            <li key={s.label} className="border border-ink bg-paper p-3">
              <div className="font-sans text-title leading-none font-extrabold tracking-display tabular-nums">{s.value}</div>
              <div className="mt-2 font-serif text-sm leading-snug text-soft">{s.label}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className={SECTION}>
        <Eyebrow>Who was here · {here}</Eyebrow>
        <ul className={clsx("mt-3", ATTENDEE_GRID)}>
          {people.map((m) => (
            <li key={m.id} className={clsx(ATTENDEE_CARD, "bg-paper")}>
              <AttendeeCardContent avatar={<Avatar member={m} size={44} />} name={m.name} badge={m.id === session.facilitatorId && <Badge variant="action">Facilitator</Badge>} caption={m.role} />
            </li>
          ))}
          {session.guests.map((g) => (
            <li key={g.id} className={clsx(ATTENDEE_CARD, "bg-wash")}>
              <AttendeeCardContent avatar={<GuestAvatar eventId={session.eventId} guest={g} />} name={g.name} caption="Guest" />
            </li>
          ))}
        </ul>
      </section>

      <section className={SECTION}>
        <Eyebrow>Notes</Eyebrow>
        {written.length > 0 && (
          <ol className="m-0 mt-3 flex list-none flex-col gap-4 p-0">
            {written.map((t) => (
              <li key={t.id} className="border border-t-[3px] border-ink border-t-agenda bg-paper p-4">
                <div className="flex items-center gap-2">
                  <AgendaBadge category={t.category} />
                  <Eyebrow className="min-w-0 flex-1 truncate text-agenda">{AGENDA_CATEGORY[t.category].label}</Eyebrow>
                </div>
                <h3 className="mt-3 mb-0 font-sans text-base leading-tight font-bold wrap-anywhere">{t.title}</h3>
                {t.details && <p className="mt-1 mb-0 font-serif text-sm leading-normal whitespace-pre-line text-soft">{t.details}</p>}
                <div className="message-text mt-2 font-serif text-base leading-normal text-body" dangerouslySetInnerHTML={{ __html: messageHtml(t.notes) }} />
                <div className="mt-3 text-right font-sans text-eyebrow font-bold text-soft tabular-nums" aria-label={`Topic ${t.position + 1}`}>
                  {t.position + 1}
                </div>
              </li>
            ))}
          </ol>
        )}
        {unwritten.length > 0 && (
          <p className="mt-3 mb-0 font-serif text-base text-soft">
            {written.length === 0 ? "No notes were taken on " : "No notes on "}
            {new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(unwritten.map((t) => `“${t.title}”`))}.
          </p>
        )}
      </section>

      {session.tasks.length > 0 && (
        <section className={SECTION}>
          <Eyebrow>Tasks · {session.tasks.length}</Eyebrow>
          <div className="mt-3">
            <MeetingTaskTable tasks={session.tasks} label="Tasks from this meeting" onOpen={(t) => router.push(`/circles/${circle.id}/tasks/${t.id}`)} />
          </div>
        </section>
      )}

      <p className="mt-10 mb-8 border border-ink bg-wash p-4 font-serif text-base text-body">
        {facilitating ? "Finishing closes the meeting. Its minutes stay open to correct." : "The facilitator finishes the meeting."}
      </p>
    </div>
  );
}
