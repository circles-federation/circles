"use client";

import clsx from "clsx";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Avatar, Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Circle, MeetingSession } from "@/lib/types";

/* Who's there. Anyone marks themself; the facilitator marks the rest. */
export function MeetingAttendanceStep({ session, circle, memberId, onSetPresent }: { session: MeetingSession; circle: Circle; memberId: number; onSetPresent: (targetId: number, present: boolean) => void }) {
  const { members } = useAppState();
  const people = circle.members.map((id) => members.find((m) => m.id === id)).filter((m) => m !== undefined);
  const facilitating = session.facilitatorId === memberId;
  return (
    <div>
      <Eyebrow className="text-soft">Who’s here · {session.attendees.length}</Eyebrow>
      <ul className="m-0 mt-4 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-0 border-t border-l border-ink p-0">
        {people.map((m) => {
          const here = session.attendees.includes(m.id);
          const mine = m.id === memberId;
          return (
            <li key={m.id} className="contents">
              <button
                type="button"
                disabled={!mine && !facilitating}
                aria-pressed={here}
                onClick={() => onSetPresent(m.id, !here)}
                className={clsx("flex items-center gap-3 border-0 border-r border-b border-ink p-4 text-left", here ? "bg-wash" : "bg-paper", mine || facilitating ? "ink-press cursor-pointer" : "cursor-default")}
              >
                <Avatar member={m} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-sm font-bold">{m.name}{mine ? " (you)" : ""}</span>
                  <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{here ? "Here" : "Not here"}</span>
                </span>
                {here && <CheckIcon className="size-5 shrink-0 text-leaf" strokeWidth={2.5} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
