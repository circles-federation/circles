"use client";

import { useState } from "react";
import { CheckIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, ConfirmModal, PageContainer, useToast } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { fmtDateTime } from "@/lib/format.util";
import { useClock } from "@/lib/hooks";
import { MESSAGE_SUBJECT_MAX, validateMessage } from "@/lib/messages.util";
import type { Circle } from "@/lib/types";
import { Letter } from "./letter";
import { MessageEditor } from "./message-editor";

interface WriteMessagePageProps {
  circle: Circle;
  // once it's sent, or once a draft's been let go of
  onDone: () => void;
}

/* Writing to a circle (its Inbox): the letter its members will read, being
   written. The same sheet of paper (Letter), from the writer to the circle,
   dated today, with the subject written straight onto it in the headline's
   size and the message under it (MessageEditor, bare), signed. Its members
   answer by email, so sending needs the writer's agreement to that, naming
   the address, under the sheet. Send is the top bar's, off until it's all
   there; a refusal from the server (too many sent lately, say) shows under
   the sheet. Back asks before letting a draft go. Sent, it goes back where
   it came from and says so. */
export function WriteMessagePage({ circle, onDone }: WriteMessagePageProps) {
  const { profile, sendMessage } = useAppState();
  const { showToast } = useToast();
  const now = useClock();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const ready = validateMessage({ subject, body, consent }) === null;
  const dirty = !sent && (subject.trim() !== "" || body.trim() !== "");

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    const result = await sendMessage(circle.id, { subject, body, consent });
    setSending(false);
    if (!result.ok) return setError(result.error);
    setSent(true);
    showToast({ tone: "success", title: `Sent to ${circle.name}`, message: `Its members will write back to you at ${profile.email}.` });
    onDone();
  }

  useTopBarAction({ label: sending ? "Sending" : "Send", icon: PaperAirplaneIcon, onAction: send, disabled: !ready || sending, variant: "primary" });
  useBackHandler(dirty && !sending ? () => setConfirmingDiscard(true) : null);

  return (
    <PageContainer size="compact">
      <Letter
        circleName={circle.name}
        from={<span className="font-bold text-ink">{profile.name}</span>}
        to={<span className="font-bold text-ink">{circle.name}</span>}
        // today, in the writer's own time: drawn once the browser's clock is known
        date={now === null ? " " : fmtDateTime(new Date(now))}
      >
        {/* the subject, written onto the page as its headline */}
        <textarea
          value={subject}
          onChange={(e) => setSubject(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          rows={1}
          maxLength={MESSAGE_SUBJECT_MAX}
          placeholder="Subject"
          aria-label="Subject"
          className="mt-5 block w-full resize-none border-0 bg-transparent p-0 font-sans text-title leading-[1.05] font-extrabold tracking-display text-ink outline-none [field-sizing:content] placeholder:text-ghost"
        />
        <div className="mt-4">
          <MessageEditor value={body} onChange={setBody} placeholder="Write your message. Select text to format it." bare />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Avatar member={profile} size={36} />
          <span className="font-serif text-xl text-ink italic">{profile.name}</span>
        </div>
      </Letter>

      {/* their agreement to be answered by email, which is how they will be */}
      <button
        type="button"
        role="checkbox"
        aria-checked={consent}
        onClick={() => setConsent((c) => !c)}
        className="mt-8 flex cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left"
      >
        <span className={clsx("hit mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 border-ink", consent ? "bg-ink text-paper" : "bg-paper")}>
          {consent && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
        </span>
        <span className="font-serif text-base leading-normal text-body">
          {circle.name}&rsquo;s members may reply to me at <strong className="font-bold text-ink">{profile.email}</strong>.
        </span>
      </button>
      {error && <p className="mt-3 font-serif text-sm text-danger">{error}</p>}
      <p className="mt-4 font-serif text-sm text-soft">Only {circle.name}&rsquo;s members read it.</p>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard this message?"
          message="It hasn't been sent. If you leave now, what you've written will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep writing"
          onConfirm={() => {
            setConfirmingDiscard(false);
            setSent(true);
            onDone();
          }}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
