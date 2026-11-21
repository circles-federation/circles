"use client";

import { useRouter } from "next/navigation";
import { MeetingTaskForm } from "./meeting-task-form";
import { MeetingTaskTable } from "./meeting-task-table";
import { Eyebrow } from "@/components/shared";
import { circleHasTasks } from "@/lib/circles.util";
import type { Circle, CircleTask, MeetingSession } from "@/lib/types";
import type { TaskInput } from "@/lib/tasks.util";

/* What needs doing after the meeting: anyone there adds a task (a title, who
   has it and when it's due), which goes into the circle's backlog like any
   other, marked as from this meeting. Whoever it's given to is told. The form
   leads and what's been added follows in the circle's own task table, so the
   field stays put as others add theirs (a list growing above it would push it
   down); a task can be deleted from its row in case those there change their
   minds, and opens in place (its own page) so Back returns to the meeting. */
export function MeetingTasksStep({
  session,
  circle,
  canAdd,
  memberId,
  onAdd,
  onDelete,
}: {
  session: MeetingSession;
  circle: Circle;
  canAdd: boolean;
  memberId: number;
  onAdd: (input: TaskInput) => Promise<boolean>;
  onDelete: (task: CircleTask) => void;
}) {
  const router = useRouter();
  if (!circleHasTasks(circle)) {
    return (
      <div>
        <Eyebrow className="text-soft">Tasks</Eyebrow>
        <p className="mt-3 font-serif text-base text-soft">This circle doesn’t keep tasks, so there’s nothing to add here.</p>
      </div>
    );
  }
  return (
    <div>
      <Eyebrow className="text-soft">Tasks · {session.tasks.length}</Eyebrow>
      <p className="mt-2 font-serif text-base text-soft">Anything that needs doing after this meeting.</p>

      {canAdd ? (
        <div className="mt-6">
          <MeetingTaskForm session={session} circle={circle} memberId={memberId} onAdd={onAdd} stateKey="meeting-task-draft" idPrefix="meeting-task" />
        </div>
      ) : (
        <p className="mt-6 font-serif text-sm text-soft">Mark yourself present to add tasks.</p>
      )}

      <div className="mt-8 border-t border-faint pt-6">
        {session.tasks.length === 0 ? (
          <p className="font-serif text-lg text-soft">Tasks you add will appear here, and in the circle’s Tasks.</p>
        ) : (
          <MeetingTaskTable tasks={session.tasks} label="Tasks added in this meeting" onOpen={(t) => router.push(`/circles/${circle.id}/tasks/${t.id}`)} onDelete={canAdd ? onDelete : undefined} />
        )}
      </div>
    </div>
  );
}
