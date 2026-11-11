"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@heroicons/react/24/outline";
import { AgendaBadge } from "./agenda-section";
import { MessageEditor } from "@/components/circles/message-editor";
import { ConfirmModal, Eyebrow, PageContainer } from "@/components/shared";
import { useBackHandler, useGoBack } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { useToast } from "@/components/shared/toast";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { saveMeetingMinutesAction } from "@/lib/db/actions";
import { useMemberById } from "@/lib/hooks";
import { messageWhen } from "@/lib/messages.util";
import { useMeetingSession } from "@/lib/use-meeting-session";
import type { Event, MeetingSession } from "@/lib/types";

/* Correcting a finished meeting's minutes: the notes on each topic, saved
   together as one edit by whoever makes it, who's then named under the minutes
   with when. Only the topics that were changed are sent, so someone else's
   correction to another one isn't undone. */
export function MeetingMinutesEditPage({ event: e }: { event: Event }) {
  const { session, lost } = useMeetingSession(e.id);
  if (lost) return <Notice>You can’t open these minutes any more. Sign in again, or check you’re still in the circle.</Notice>;
  if (session === undefined) return null;
  if (session === null) return <Notice>This meeting hasn’t been held.</Notice>;
  if (session.status === "live") {
    return (
      <Notice>
        The meeting is still going. Its notes are written in the{" "}
        <Link href={`/events/${e.id}/live`} className="font-bold text-ink underline">
          meeting
        </Link>
        ; the minutes can be corrected once it’s finished.
      </Notice>
    );
  }
  return <MinutesForm eventId={e.id} session={session} />;
}

function MinutesForm({ eventId, session }: { eventId: string; session: MeetingSession }) {
  const { adopt } = useMeetingSession(eventId, false);
  const { showToast } = useToast();
  const memberById = useMemberById();
  const goBack = useGoBack();
  // the notes as they were when it opened, which is what's compared with, and
  // what someone else's change since is noticed against
  const [base] = useState(() => new Map(session.topics.map((t) => [t.position, t.notes])));
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const changed = session.topics.filter((t) => edits[t.position] !== undefined && edits[t.position] !== base.get(t.position));
  const dirty = changed.length > 0;
  const editor = session.minutesEditedBy !== undefined ? memberById(session.minutesEditedBy) : undefined;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    const result = await saveMeetingMinutesAction(
      eventId,
      changed.map((t) => ({ position: t.position, notes: edits[t.position]! })),
    );
    if (!result.ok) {
      setSaving(false);
      return setError(result.error);
    }
    adopt(result.value);
    showToast({ tone: "success", title: "Minutes saved" });
    goBack();
  }

  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Save minutes", icon: CheckIcon, onAction: () => void save(), disabled: !dirty || saving, variant: "primary" });

  return (
    <PageContainer size="compact">
      {session.minutesEditedAt && (
        <p className="m-0 mb-6 font-sans text-xs font-bold tracking-open text-soft">
          Last edited{editor ? ` by ${editor.name}` : ""} {messageWhen(session.minutesEditedAt)}
        </p>
      )}
      <ol className="m-0 flex list-none flex-col gap-8 p-0">
        {session.topics.map((t) => {
          const elsewhere = changed.some((c) => c.position === t.position) && t.notes !== base.get(t.position);
          return (
            <li key={t.position} className="border-t-[3px] border-t-agenda pt-3">
              <div className="flex items-center gap-2">
                <AgendaBadge category={t.category} />
                <Eyebrow className="text-agenda">{AGENDA_CATEGORY[t.category].label}</Eyebrow>
              </div>
              <div className="mt-2 font-sans text-base leading-tight font-bold wrap-anywhere">{t.title}</div>
              <div className="mt-3">
                <MessageEditor
                  id={`minutes-${t.position}`}
                  label={`Notes on ${t.title}`}
                  value={edits[t.position] ?? t.notes}
                  placeholder="Nothing written. Select text to format it."
                  onChange={(text) => setEdits({ ...edits, [t.position]: text })}
                />
              </div>
              {elsewhere && <p className="mt-2 font-sans text-xs font-bold text-flame">Someone else has changed these notes. Saving will replace their version.</p>}
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="mt-6 font-sans text-sm font-bold text-danger">{error}</p>}

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to the minutes. If you leave now, they’ll be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => {
            setConfirmingDiscard(false);
            goBack();
          }}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer size="compact">
      <p className="font-serif text-lg text-soft">{children}</p>
    </PageContainer>
  );
}
