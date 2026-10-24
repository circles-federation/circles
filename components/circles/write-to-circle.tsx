"use client";

import { useState } from "react";
import { CheckIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button, Eyebrow, Input, Label } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { MESSAGE_SUBJECT_MAX, validateMessage } from "@/lib/messages.util";
import type { Circle } from "@/lib/types";
import { MessageEditor } from "./message-editor";

/* Writing to a circle, from its wiki, while its Inbox is on: a subject, and
   a message formatted as it's written (MessageEditor). Its members read it
   in their Inbox, and answer by email: sending needs the sender's agreement
   to that, naming the address. Send stays off until it's all there; a
   refusal from the server (too many sent lately, say) shows under it. Sent,
   it says so, with a way to write another. */
export function WriteToCircle({ circle }: { circle: Circle }) {
  const { profile, sendMessage } = useAppState();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // the editor starts afresh for another message
  const [draft, setDraft] = useState(0);
  const ready = validateMessage({ subject, body, consent }) === null;

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    const result = await sendMessage(circle.id, { subject, body, consent });
    setSending(false);
    if (!result.ok) return setError(result.error);
    setSent(true);
  }

  if (sent) {
    return (
      <div aria-live="polite">
        <Eyebrow className="text-soft">Write to {circle.name}</Eyebrow>
        <p className="mt-3 font-sans text-lg font-extrabold tracking-heading">Sent.</p>
        <p className="mt-1 font-serif text-base text-body">
          {circle.name}&rsquo;s members will write back to you at {profile.email}.
        </p>
        <Button
          variant="secondary"
          size="compact"
          className="mt-4"
          onClick={() => {
            setSubject("");
            setBody("");
            setConsent(false);
            setSent(false);
            setDraft((n) => n + 1);
          }}
        >
          Write another
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow className="text-soft">Write to {circle.name}</Eyebrow>
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Label htmlFor="message-subject">Subject</Label>
          <Input id="message-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={MESSAGE_SUBJECT_MAX} placeholder="What it's about" />
        </div>
        <div>
          <Label htmlFor="message-body">Message</Label>
          <MessageEditor key={draft} id="message-body" value={body} onChange={setBody} placeholder="Select text to format it." />
        </div>
        {/* their agreement to be answered by email, which is how they will be */}
        <button
          type="button"
          role="checkbox"
          aria-checked={consent}
          onClick={() => setConsent((c) => !c)}
          className="flex cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left"
        >
          <span className={clsx("hit mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 border-ink", consent ? "bg-ink text-paper" : "bg-paper")}>
            {consent && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
          </span>
          <span className="font-serif text-base leading-normal text-body">
            {circle.name}&rsquo;s members may reply to me at <strong className="font-bold text-ink">{profile.email}</strong>.
          </span>
        </button>
        <Button onClick={send} disabled={!ready || sending} className="w-full">
          <PaperAirplaneIcon className="size-4" strokeWidth={2} />
          {sending ? "Sending" : "Send"}
        </Button>
        {error && <p className="font-serif text-sm text-danger">{error}</p>}
        <p className="-mt-1 text-center font-serif text-sm text-soft">Only {circle.name}&rsquo;s members read it.</p>
      </div>
    </div>
  );
}
