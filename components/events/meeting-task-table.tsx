"use client";

import { TaskTable } from "@/components/circles/task-table";
import { useAppState } from "@/components/providers/app-state-provider";
import type { CircleTask } from "@/lib/types";

/* A meeting's tasks in the circle's own task table. The session holds each as
   it was when the meeting last changed; one ticked (or edited) since is in
   app state, which is shown in its place so the table doesn't lag behind. */
export function MeetingTaskTable({ tasks, label, onOpen, onDelete }: { tasks: CircleTask[]; label: string; onOpen: (task: CircleTask) => void; onDelete?: (task: CircleTask) => void }) {
  const { tasks: current } = useAppState();
  const live = tasks.map((t) => current.find((c) => c.id === t.id) ?? t);
  // the wizard's column is narrow: no Status (an in-progress task says so under
  // its title), and no Priority while every task is Normal, the way they're made here
  const hide: ("status" | "priority")[] = live.every((t) => t.priority === "none") ? ["status", "priority"] : ["status"];
  return <TaskTable tasks={live} label={label} onOpen={onOpen} onDelete={onDelete} hide={hide} />;
}
