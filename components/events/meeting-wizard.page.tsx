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
import { addMeetingTaskAction, addMeetingTopicAction, finishMeetingAction, removeMeetingTopicAction, saveMeetingNotesAction, setMeetingPresentAction, setMeetingStepAction, startMeetingAction, takeOverMeetingAction } from "@/lib/db/actions";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useClock, useMemberById } from "@/lib/hooks";
import { canRunMeeting, lastStep, stepAt } from "@/lib/meeting-session.util";
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
  const { adoptTask } = useAppState();
  const router = useRouter();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);

  // whatever an action returns is adopted at once; a refusal is a toast
  const run = async (action: Promise<Result>): Promise<boolean> => {
    const result = await action;
    if (result.ok) adopt(result.value);
    else showToast({ message: result.error, tone: "error" });
    return result.ok;
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
        {step?.kind === "attendance" && <MeetingAttendanceStep session={session} circle={circle} memberId={memberId} onSetPresent={(id, present) => void run(setMeetingPresentAction(e.id, id, present))} />}
        {step?.kind === "agenda" && <MeetingAgendaStep session={session} canEdit={attending} onAdd={(item) => run(addMeetingTopicAction(e.id, item))} onRemove={(position) => void run(removeMeetingTopicAction(e.id, position))} />}
        {topic && <MeetingTopicStep key={topic.position} topic={topic} canWrite={attending} onSave={(notes) => run(saveMeetingNotesAction(e.id, topic.position, notes))} />}
        {step?.kind === "tasks" && (
          <MeetingTasksStep
            session={session}
            circle={circle}
            canAdd={attending}
            memberId={memberId}
            onAdd={async (input) => {
              const result = await addMeetingTaskAction(e.id, input);
              if (!result.ok) {
                showToast({ message: result.error, tone: "error" });
                return false;
              }
              adopt(result.value.session);
              adoptTask(result.value.task);
              return true;
            }}
          />
        )}
        {step?.kind === "wrapup" && <MeetingWrapupStep session={session} facilitating={facilitating} />}
      </div>

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
