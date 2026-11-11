"use client";

import clsx from "clsx";
import { stepAt } from "@/lib/meeting-session.util";
import type { MeetingSession } from "@/lib/types";

/* Where the meeting is: attendance, the agenda, a square per topic, tasks, wrap-up. The
   facilitator can jump to any; everyone else sees it move. */
export function MeetingStepper({ session, canMove, onStep }: { session: MeetingSession; canMove: boolean; onStep: (step: number) => void }) {
  const count = session.topics.length;
  const steps = Array.from({ length: count + 4 }, (_, i) => i);
  const label = (i: number) => {
    const s = stepAt(i, count);
    return s?.kind === "attendance" ? "Attendance" : s?.kind === "agenda" ? "Agenda" : s?.kind === "topic" ? `Topic ${s.index + 1}` : s?.kind === "tasks" ? "Tasks" : "Wrap-up";
  };
  return (
    <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Steps">
      {steps.map((i) => (
        <li key={i}>
          <button
            type="button"
            disabled={!canMove}
            aria-current={i === session.step ? "step" : undefined}
            aria-label={label(i)}
            title={label(i)}
            onClick={() => onStep(i)}
            className={clsx(
              "hit h-8 min-w-8 border border-ink px-2 font-sans text-xs font-bold",
              i === session.step ? "bg-ink text-paper" : i < session.step ? "bg-wash text-ink" : "bg-paper text-ink",
              canMove ? "ink-press cursor-pointer" : "cursor-default",
            )}
          >
            {i === 0 ? "A" : i === 1 ? "≡" : i <= count + 1 ? i - 1 : i === count + 2 ? "T" : "✓"}
          </button>
        </li>
      ))}
    </ol>
  );
}
