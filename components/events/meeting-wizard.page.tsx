"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon } from "@heroicons/react/24/outline";
import { MeetingAgendaStep } from "./meeting-agenda-step";
import { MeetingAttendanceStep } from "./meeting-attendance-step";
import { MeetingMinutes } from "./meeting-minutes";
import { MeetingStepper } from "./meeting-stepper";
import { MeetingTasksStep } from "./meeting-tasks-step";
import { MeetingTopicStep } from "./meeting-topic-step";
import { MeetingWrapupStep } from "./meeting-wrapup-step";
import { Button, ConfirmModal, Eyebrow, PageContainer } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { useToast } from "@/components/shared/toast";
import { addMeetingGuestAction, addMeetingTaskAction, moveMeetingTopicAction, removeMeetingTaskAction, addMeetingTopicAction, finishMeetingAction, removeMeetingGuestAction, removeMeetingTopicAction, saveMeetingNotesAction, setMeetingPresentAction, setMeetingStepAction, startMeetingAction, takeOverMeetingAction } from "@/lib/db/actions";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useClock, useMemberById } from "@/lib/hooks";
import { canRunMeeting, lastStep, stepAt } from "@/lib/meeting-session.util";
import type { TaskInput } from "@/lib/tasks.util";
import { useMeetingSession } from "@/lib/use-meeting-session";
import type { Circle, Event, MeetingSession } from "@/lib/types";

type Result = { ok: true; value: MeetingSession } | { ok: false; error: string };

/* The meeting, as everyone in its circle sees it: one shared session, so what
   the facilitator moves on to is where everyone is. The facilitator's Next is
   the top bar's action, and the wrap-up's is Finish; anyone attending can take
   over as facilitator. */
export function MeetingWizardPage({ event: e, circle, memberId }: { event: Event; circle: Circle; memberId: number }) {
  const { session, adopt, lost } = useMeetingSession(e.id);
  const { showToast } = useToast();
  const memberById = useMemberById();
  const now = useClock();
  const goBack = useGoBack();
  const { adoptTask, dropTask } = useAppState();
  const router = useRouter();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);
  const [deletingTask, setDeletingTask] = useState<{ id: string; title: string } | null>(null);

  // whatever an action returns is adopted at once; a refusal is a toast
  const run = async (action: Promise<Result>, errorTitle?: string): Promise<boolean> => {
    const result = await action;
    if (result.ok) adopt(result.value);
    else showToast({ ...(errorTitle ? { title: errorTitle } : {}), message: result.error, tone: "error" });
    return result.ok;
  };

  // a task made here, from the Tasks step or from a topic: adopted into app
  // state so the circle's Tasks and Home show it without waiting for a refresh
  const addTask = async (input: TaskInput): Promise<boolean> => {
    const result = await addMeetingTaskAction(e.id, input);
    if (!result.ok) {
      showToast({ title: "Couldn’t add task", message: result.error, tone: "error" });
      return false;
    }
    adopt(result.value.session);
    adoptTask(result.value.task);
    return true;
  };

  const live = session?.status === "live";
  const facilitating = live && session.facilitatorId === memberId;
  const count = session?.topics.length ?? 0;
  const last = lastStep(count);
  const atEnd = session ? session.step >= last : false;

  useTopBarAction(
    facilitating
      ? atEnd
        ? { label: "Finish meeting", text: "Finish", icon: CheckIcon, variant: "primary", onAction: () => setConfirmFinish(true) }
        : { label: "Next step", text: "Next", icon: ArrowRightIcon, variant: "primary", onAction: () => void run(setMeetingStepAction(e.id, session.step + 1)) }
      : null,
  );

  if (lost) return <Notice>You can’t follow this meeting any more. Sign in again, or check you’re still in the circle.</Notice>;
  if (session === undefined) return null;

  if (session === null) {
    const canRun = now !== null && canRunMeeting(e, new Date(now));
    return (
      <PageContainer size="compact">
        <Eyebrow className="text-soft">{e.title}</Eyebrow>
        <p className="mt-3 font-serif text-lg text-body">
          {canRun ? "Start the meeting for everyone in the circle to follow along." : "A meeting can be run from its start time until a day after it ends."}
        </p>
        {canRun && (
          <div className="mt-6">
            <Button onClick={() => void run(startMeetingAction(e.id))}>Run meeting</Button>
          </div>
        )}
      </PageContainer>
    );
  }

  if (!live) {
    return (
      <PageContainer size="compact">
        <Eyebrow className="text-soft">Minutes</Eyebrow>
        <p className="mt-2 font-serif text-base text-soft">This meeting has finished.</p>
        <div className="mt-6">
          <MeetingMinutes session={session} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => router.push(`/events/${e.id}/minutes`)}>Edit minutes</Button>
          <Button variant="secondary" onClick={() => goBack()}>
            Back to the event
          </Button>
        </div>
      </PageContainer>
    );
  }

  const step = stepAt(session.step, count);
  const attending = session.attendees.includes(memberId);
  const facilitator = session.facilitatorId !== null ? memberById(session.facilitatorId) : undefined;
  const topic = step?.kind === "topic" ? session.topics[step.index] : undefined;

  return (
    <PageContainer size="compact">
      <MeetingStepper session={session} canMove={facilitating} onStep={(s) => void run(setMeetingStepAction(e.id, s))} />
      <p className="mt-4 font-serif text-sm text-soft">
        {facilitating ? "You’re the facilitator" : facilitator ? `${facilitator.name} is the facilitator` : "There’s no facilitator"}
        {session.facilitatorId !== null && !session.attendees.includes(session.facilitatorId) ? `, but ${facilitating ? "you aren’t" : "isn’t"} marked present.` : "."}
        {/* a quiet link and not a button, and asked about first: it takes the
            meeting out of someone else's hands for everyone */}
        {!facilitating && attending && (
          <>
            {" "}
            <button type="button" onClick={() => setConfirmTakeOver(true)} className="hit cursor-pointer border-0 bg-transparent p-0 font-serif text-sm font-bold text-ink underline">
              Take over
            </button>
          </>
        )}
      </p>

      <div className="mt-8">
        {step?.kind === "attendance" && <MeetingAttendanceStep
            session={session}
            circle={circle}
            memberId={memberId}
            onSetPresent={(id, present) => void run(setMeetingPresentAction(e.id, id, present))}
            onAddGuest={(input) => run(addMeetingGuestAction(e.id, input), "Couldn’t add guest")}
            onRemoveGuest={(guestId) => void run(removeMeetingGuestAction(e.id, guestId), "Couldn’t remove guest")}
          />}
        {step?.kind === "agenda" && <MeetingAgendaStep session={session} canEdit={attending} onAdd={(item) => run(addMeetingTopicAction(e.id, item))} onRemove={(topicId) => void run(removeMeetingTopicAction(e.id, topicId))} onMove={(topicId, by) => void run(moveMeetingTopicAction(e.id, topicId, by), "Couldn’t move topic")} />}
        {topic && <MeetingTopicStep key={topic.id} topic={topic} canWrite={attending} onSave={(notes) => run(saveMeetingNotesAction(e.id, topic.id, notes))} session={session} circle={circle} memberId={memberId} onAddTask={addTask} />}
        {step?.kind === "tasks" && (
          <MeetingTasksStep
            session={session}
            circle={circle}
            canAdd={attending}
            memberId={memberId}
            onAdd={addTask}
            onDelete={(t) => setDeletingTask({ id: t.id, title: t.title })}
          />
        )}
        {step?.kind === "wrapup" && <MeetingWrapupStep session={session} event={e} circle={circle} facilitating={facilitating} />}
      </div>

      {deletingTask && (
        <ConfirmModal
          title="Delete this task?"
          message={`“${deletingTask.title}” will be removed from the circle’s tasks too.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          onCancel={() => setDeletingTask(null)}
          onConfirm={() => {
            const { id } = deletingTask;
            setDeletingTask(null);
            // gone from the circle's tasks as well, not just this list
            void run(removeMeetingTaskAction(e.id, id), "Couldn’t delete task").then((ok) => {
              if (ok) dropTask(id);
            });
          }}
        />
      )}

      {confirmTakeOver && (
        <ConfirmModal
          title="Take over as facilitator?"
          message={`${facilitator ? facilitator.name : "The facilitator"} will no longer move the meeting on; only you will. Anyone attending can take it back.`}
          confirmLabel="Take over"
          cancelLabel="Cancel"
          tone="ink"
          onCancel={() => setConfirmTakeOver(false)}
          onConfirm={() => {
            setConfirmTakeOver(false);
            void run(takeOverMeetingAction(e.id));
          }}
        />
      )}

      {confirmFinish && (
        <ConfirmModal
          title="Finish the meeting?"
          message="Attendance and the steps close. The circle’s members can still correct the minutes."
          confirmLabel="Finish"
          cancelLabel="Keep going"
          tone="ink"
          onCancel={() => setConfirmFinish(false)}
          onConfirm={() => {
            setConfirmFinish(false);
            void run(finishMeetingAction(e.id));
          }}
        />
      )}
    </PageContainer>
  );
}

function Notice({ children }: { children: string }) {
  return (
    <PageContainer size="compact">
      <p className="font-serif text-lg text-soft">{children}</p>
    </PageContainer>
  );
}
