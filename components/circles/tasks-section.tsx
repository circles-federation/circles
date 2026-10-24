"use client";

import { useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Circle, CircleTask } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";
import { TaskFormModal } from "./task-form";
import { TaskTable } from "./task-table";

interface TasksSectionProps {
  circle: Circle;
  // the top bar's menu opens the add form, so the page owns that
  adding: boolean;
  onAdd: () => void;
  onAddingDone: () => void;
  // on a phone a task opens as a page
  onOpenPage: (task: CircleTask) => void;
}

/* A circle's backlog, for its members only (the page shows the tab to no one
   else, and only members are sent its tasks): every task in one table, what's
   done last and the back burner (zzz) just above it. On desktop a task opens in a dialog; on a phone,
   as a page. */
export function TasksSection({ circle, adding, onAdd, onAddingDone, onOpenPage }: TasksSectionProps) {
  const { tasks } = useAppState();
  const mine = tasks.filter((t) => t.circleId === circle.id);
  const [editing, setEditing] = useState<CircleTask | null>(null);
  const open = (t: CircleTask) => (isPhoneWidth() ? onOpenPage(t) : setEditing(t));

  return (
    <div>
      {mine.length === 0 ? (
        // an empty backlog offers the first task, as the bulletin does its first item
        <button
          type="button"
          onClick={onAdd}
          className="ink-press flex w-full cursor-pointer flex-col items-center gap-1.5 border border-dashed border-soft bg-transparent px-6 py-7 text-center text-soft"
        >
          <PlusIcon className="size-6" strokeWidth={2} aria-hidden />
          <Eyebrow className="text-soft">Add a task</Eyebrow>
          <span className="mt-1 font-serif text-base">Keep track of what {circle.name} needs to get done, and who&rsquo;s doing it.</span>
        </button>
      ) : (
        <TaskTable tasks={mine} onOpen={open} label={`${circle.name}'s tasks`} />
      )}

      {(adding || editing) && (
        <TaskFormModal
          circle={circle}
          task={editing}
          onClose={() => {
            setEditing(null);
            onAddingDone();
          }}
        />
      )}
    </div>
  );
}
