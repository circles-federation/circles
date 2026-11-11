"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/shared";
import { circleHasTasks } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";

/* Where tasks that came out of the meeting are added: for now the circle's own
   Tasks section; adding them here, linked to the minutes, comes next. */
export function MeetingTasksStep({ circle }: { circle: Circle }) {
  return (
    <div>
      <Eyebrow className="text-soft">Tasks</Eyebrow>
      <p className="mt-3 font-serif text-lg text-body">Anything that needs doing after this meeting.</p>
      {circleHasTasks(circle) && (
        <p className="mt-3 font-serif text-base text-soft">
          Add them in the circle’s{" "}
          <Link href={`/circles/${circle.id}/tasks`} target="_blank" className="font-bold text-ink underline">
            Tasks
          </Link>
          .
        </p>
      )}
    </div>
  );
}
