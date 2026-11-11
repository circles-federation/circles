"use client";

import clsx from "clsx";
import { stepAt, stepLabel } from "@/lib/meeting-session.util";
import type { MeetingSession } from "@/lib/types";

/* Where the meeting is, in words and as squares: "Step 2 of 7 · Agenda" over
   attendance, the agenda, a square per topic, tasks and the wrap-up. The
   facilitator can jump to any; for everyone else the squares only show it
   move, so they read as marks and not as buttons. From a tablet's width the
   squares that aren't a topic carry their names. */
export function MeetingStepper({ session, canMove, onStep }: { session: MeetingSession; canMove: boolean; onStep: (step: number) => void }) {
  const count = session.topics.length;
  const total = count + 4;
  const steps = Array.from({ length: total }, (_, i) => i);
  const glyph = (i: number) => (i === 0 ? "A" : i === 1 ? "≡" : i <= count + 1 ? String(i - 1) : i === count + 2 ? "T" : "✓");
  const named = (i: number) => stepAt(i, count)?.kind !== "topic";
  return (
    <div>
      <p className="m-0 mb-3 font-sans text-xs font-bold tracking-caps text-soft uppercase" aria-live="polite">
        Step {session.step + 1} of {total} · {stepLabel(session.step, count)}
      </p>
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Steps">
        {steps.map((i) => {
          const current = i === session.step;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!canMove}
                aria-current={current ? "step" : undefined}
                aria-label={stepLabel(i, count)}
                title={stepLabel(i, count)}
                onClick={() => onStep(i)}
                className={clsx(
                  "hit h-8 min-w-8 px-2 font-sans text-xs font-bold",
                  current ? "border border-ink bg-ink text-paper" : canMove ? "ink-press border border-ink bg-paper text-ink" : i < session.step ? "border border-faint bg-wash text-soft" : "border border-faint bg-paper text-soft",
                  canMove ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span className={named(i) ? "min-[720px]:hidden" : undefined}>{glyph(i)}</span>
                {named(i) && <span className="hidden min-[720px]:inline">{stepLabel(i, count)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
