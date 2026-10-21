"use client";

import { useState } from "react";
import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { onBackBurner, sortTasks } from "@/lib/tasks.util";
import type { Circle, CircleTask } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";
import { TaskFormModal } from "./task-form";
import { TaskRow } from "./task-row";

interface TasksSectionProps {
  circle: Circle;
  // the page's floating + opens the add form, so the page owns that
  adding: boolean;
  onAdd: () => void;
  onAddingDone: () => void;
  // on a phone a task opens as a page
  onOpenPage: (task: CircleTask) => void;
}

/* A circle's backlog, for its members only (the page shows the tab to no one
   else, and only members are sent its tasks): what's in progress, what's to
   do, most pressing first, then the back burner (zzz) and what's done, each
   folded away until opened. On desktop a task opens in a dialog; on a phone,
   as a page. */
export function TasksSection({ circle, adding, onAdd, onAddingDone, onOpenPage }: TasksSectionProps) {
  const { tasks } = useAppState();
  const mine = sortTasks(tasks.filter((t) => t.circleId === circle.id));
  const doing = mine.filter((t) => t.status === "doing");
  const todo = mine.filter((t) => t.status === "todo" && !onBackBurner(t));
  const backBurner = mine.filter(onBackBurner);
  const done = mine.filter((t) => t.status === "done");
  const [editing, setEditing] = useState<CircleTask | null>(null);
  const open = (t: CircleTask) => (isPhoneWidth() ? onOpenPage(t) : setEditing(t));

  return (
    <div className="flex flex-col gap-8">
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
        <>
          <TaskList label="In progress" tasks={doing} onOpen={open} />
          <TaskList label="To do" tasks={todo} onOpen={open} empty={doing.length === 0 ? "Nothing to do. Add a task with the +." : undefined} />
          <TaskList label="Back burner" tasks={backBurner} onOpen={open} folded />
          <TaskList label="Done" tasks={done} onOpen={open} folded />
        </>
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

/* One part of the backlog, under its heading and count. One `folded` starts
   closed (the back burner, what's done), its heading a button that opens it;
   one with nothing in it isn't shown, unless it has something to say. */
function TaskList({ label, tasks, onOpen, folded = false, empty }: { label: string; tasks: CircleTask[]; onOpen: (t: CircleTask) => void; folded?: boolean; empty?: string }) {
  const [open, setOpen] = useState(!folded);
  if (tasks.length === 0 && !empty) return null;
  const heading = (
    <span className="flex items-center gap-2">
      <Eyebrow className="text-soft">{label}</Eyebrow>
      <span className="font-sans text-xs font-bold text-soft">{tasks.length}</span>
    </span>
  );
  return (
    <section>
      {folded ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="hit flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0">
          {heading}
          <ChevronDownIcon className={clsx("size-4 text-soft transition-transform duration-(--motion-small)", open && "rotate-180")} strokeWidth={2.5} aria-hidden />
        </button>
      ) : (
        heading
      )}
      {open &&
        (tasks.length === 0 ? (
          <p className="mt-3 font-serif text-base text-soft">{empty}</p>
        ) : (
          <ul className="m-0 mt-3 list-none border-t border-ink p-0">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={() => onOpen(t)} />
            ))}
          </ul>
        ))}
    </section>
  );
}
