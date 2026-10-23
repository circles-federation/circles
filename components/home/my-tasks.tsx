"use client";

import Link from "next/link";
import { CheckIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { useCirclesById, useTaskTick } from "@/lib/hooks";
import { localDay } from "@/lib/recurrence.util";
import { dueCell, onBackBurner, sortTasks, taskPriority } from "@/lib/tasks.util";
import { HomeSection } from "./home-section";

/* What's yours to do across your circles, as rows rather than the Tasks
   tab's table: a round button that marks each done, its title, when it's due
   and its circle, and its priority's mark; the row opens the task. Not
   what's done or on the back burner. One ticked done here stays, struck
   through, until Home is left, so a slip of the thumb can be put back as it
   was (In progress stays In progress). */
export function MyTasks() {
  const { tasks, profile } = useAppState();
  const byId = useCirclesById();
  const { toggle, tickedHere } = useTaskTick();
  const mine = sortTasks(tasks.filter((t) => t.assigneeId === profile.id && ((t.status !== "done" && !onBackBurner(t)) || tickedHere(t.id))));
  if (mine.length === 0) return null;
  const today = localDay();

  return (
    <HomeSection label="My tasks" count={mine.filter((t) => t.status !== "done").length}>
      <div className="border-t border-ink">
        {mine.map((t) => {
          const done = t.status === "done";
          const due = dueCell(t, today);
          const priority = taskPriority(t.priority);
          return (
            <div key={t.id} className="flex items-center gap-4 border-b border-faint last:border-b-ink">
              <button
                type="button"
                onClick={() => toggle(t)}
                aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                aria-pressed={done}
                className={clsx("hit flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-ink", done ? "btn-invert btn-ink bg-ink text-paper" : "ink-press bg-paper text-ink")}
              >
                {done && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
              </button>
              <Link href={`/circles/${t.circleId}/tasks/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2 text-ink no-underline">
                <div className="min-w-0 flex-1">
                  <div className={clsx("truncate font-sans text-base font-bold", done && "text-soft line-through")}>{t.title}</div>
                  <div className="mt-0.5 truncate font-serif text-sm text-soft">
                    {due && <span className={clsx(due.overdue && "font-bold text-danger")}>{due.text}{due.overdue && <span className="sr-only"> (overdue)</span>} · </span>}
                    {t.status === "doing" && "In progress · "}
                    {byId[t.circleId]?.name}
                  </div>
                </div>
                {priority.mark && (
                  <span title={priority.label} className="shrink-0 text-base leading-none">
                    {priority.mark}
                    <span className="sr-only">{priority.label}</span>
                  </span>
                )}
                <ChevronRightIcon className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
              </Link>
            </div>
          );
        })}
      </div>
    </HomeSection>
  );
}
