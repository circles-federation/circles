"use client";

import { MeetingMinutes } from "./meeting-minutes";
import { useMemberById } from "@/lib/hooks";
import type { MeetingSession } from "@/lib/types";

/* The last step, under the stepper's "Wrap-up": what the meeting came to, at a
   glance (who was here, how many topics have notes, how many tasks), then what
   was written, with the topics nothing was written on folded into one line
   rather than listed empty. */
export function MeetingWrapupStep({ session, facilitating }: { session: MeetingSession; facilitating: boolean }) {
  const memberById = useMemberById();
  const here = session.attendees.map((id) => memberById(id)?.name).filter((n): n is string => !!n);
  const withNotes = session.topics.filter((t) => t.notes.trim()).length;
  const stats: { value: number; label: string }[] = [
    { value: here.length, label: here.length === 1 ? "person here" : "people here" },
    { value: withNotes, label: `of ${session.topics.length} ${session.topics.length === 1 ? "topic has" : "topics have"} notes` },
    { value: session.tasks.length, label: session.tasks.length === 1 ? "task" : "tasks" },
  ];
  return (
    <div>
      <ul className="m-0 grid list-none grid-cols-3 border-t border-l border-ink p-0">
        {stats.map((s) => (
          <li key={s.label} className="border-r border-b border-ink p-3">
            <div className="font-sans text-title leading-none font-extrabold tracking-display tabular-nums">{s.value}</div>
            <div className="mt-2 font-serif text-sm leading-snug text-soft">{s.label}</div>
          </li>
        ))}
      </ul>
      {here.length > 0 && <p className="mt-3 font-serif text-sm text-soft">Here: {here.join(", ")}.</p>}
      <p className="mt-4 mb-8 font-serif text-base text-soft">
        {facilitating ? "Finishing closes the meeting. Its minutes stay open to correct." : "The facilitator finishes the meeting."}
      </p>
      <MeetingMinutes session={session} collapseEmpty />
    </div>
  );
}
