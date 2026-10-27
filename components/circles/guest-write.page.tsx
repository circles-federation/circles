"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button, ButtonLink, Input, Label, Modal } from "@/components/shared";
import { fmtDateTime } from "@/lib/format.util";
import { confirmGuestMessageAction, resendGuestMessageCodeAction, startGuestMessageAction } from "@/lib/guest-message";
import { GUEST_NAME_MAX, validateGuest } from "@/lib/guest-rsvp.util";
import { useClock } from "@/lib/hooks";
import { MESSAGE_SUBJECT_MAX, validateMessage } from "@/lib/messages.util";
import { Letter } from "./letter";
import { MessageEditor } from "./message-editor";

type Step = "write" | "code" | "done";

interface GuestWritePageProps {
  circle: { id: string; name: string };
  // how many a day one address may send
  perDay: number;
}

/* Writing to a circle without an account (/wiki/[id]/write), from its public
   wiki while its Inbox is on: the same letter a member writes (Letter,
   MessageEditor), signed with the name they give, then their email and their
   agreement to be answered at it. Send emails a code to that address; the
   message reaches the circle only once the code's entered (a dialog, as a
   guest's RSVP), and ends on a green check. Framed like the public wiki, with
   the way back to it. */
export function GuestWritePage({ circle, perDay }: GuestWritePageProps) {
  const router = useRouter();
  const now = useClock();
  const [step, setStep] = useState<Step>("write");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = validateGuest(name, email) === null && validateMessage({ subject, body, consent }) === null;
  const signature = name.trim() || "Your name";

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await startGuestMessageAction(circle.id, name, email, { subject, body, consent });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setId(result.id);
    setCode("");
    setDevCode(result.code ?? null);
    setStep("code");
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await confirmGuestMessageAction(id, code);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setStep("done");
  }

  async function handleResend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await resendGuestMessageCodeAction(id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDevCode(result.code ?? null);
  }

  return (
    <div className="min-h-dvh bg-paper px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-160">
        <Link href="/" className="font-sans text-sm font-extrabold tracking-heading text-ink no-underline">
          Circles
        </Link>
        <Link href={`/wiki/${circle.id}`} className="mt-6 flex items-center gap-2 font-sans text-sm font-bold text-ink underline underline-offset-2">
          <ArrowLeftIcon className="size-4" strokeWidth={2} aria-hidden />
          {circle.name}
        </Link>

        <form onSubmit={handleSend} className="mt-6">
          <Letter
            circleName={circle.name}
            from={<span className={clsx("font-bold", name.trim() ? "text-ink" : "text-ghost")}>{signature}</span>}
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
            <div className={clsx("mt-6 font-serif text-xl italic", name.trim() ? "text-ink" : "text-ghost")}>{signature}</div>
          </Letter>

          {/* who they are, and where they'll be answered */}
          <div className="mt-8 grid gap-4 min-[600px]:grid-cols-2">
            <div>
              <Label htmlFor="guest-name">Your name</Label>
              <Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={GUEST_NAME_MAX} autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="guest-email">Your email</Label>
              <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
            </div>
          </div>

          {/* their agreement to be answered by email, which is how they will be */}
          <button
            type="button"
            role="checkbox"
            aria-checked={consent}
            onClick={() => setConsent((c) => !c)}
            className="mt-6 flex cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left"
          >
            <span className={clsx("hit mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 border-ink", consent ? "bg-ink text-paper" : "bg-paper")}>
              {consent && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
            </span>
            <span className="font-serif text-base leading-normal text-body">
              {circle.name}&rsquo;s members may reply to me at {email.trim() ? <strong className="font-bold text-ink">{email.trim()}</strong> : "my email"}.
            </span>
          </button>

          {step === "write" && error && <p className="mt-3 font-sans text-xs font-bold text-danger">{error}</p>}
          <Button type="submit" disabled={!ready || busy} className="mt-6 w-full">
            {busy && step === "write" ? "Sending code…" : "Send"}
          </Button>
          <p className="mt-4 font-serif text-sm leading-normal text-soft">
            No account needed: we&apos;ll email you a code to check the address is yours, and your message goes once it&apos;s entered. Only {circle.name}&rsquo;s members read
            it, and you can send {perDay} messages a day. See the{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">
              privacy notes
            </a>
            .
          </p>
        </form>
      </div>

      {step === "code" && (
        <Modal onClose={() => setStep("write")} className="max-w-110" title="Check your email">
          <form onSubmit={handleConfirm} className="px-6 pt-2 pb-6">
            <p className="mb-4 font-serif text-base leading-normal text-body">
              We sent a code to <strong className="text-ink">{email.trim()}</strong>. Enter it to send your message.
            </p>
            {devCode && (
              <div className="mb-4 border border-dashed border-soft px-3 py-3 font-sans text-sm text-soft">
                Dev mode — here&apos;s your code (production only emails it): <strong className="tracking-[0.08em] text-ink">{devCode}</strong>
              </div>
            )}
            <Label htmlFor="guest-code">Code</Label>
            <Input
              id="guest-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="tracking-[0.2em]"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
            />
            {error && <p className="mt-3 font-sans text-xs font-bold text-danger">{error}</p>}
            <Button type="submit" disabled={busy || code.trim().length !== 6} className="mt-5 w-full">
              {busy ? "Sending…" : "Send message"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleResend} disabled={busy} className="mt-3 w-full">
              Send a new code
            </Button>
          </form>
        </Modal>
      )}

      {step === "done" && (
        <Modal onClose={() => router.push(`/wiki/${circle.id}`)} className="max-w-110" title="Sent">
          <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
            <div className="flex size-28 items-center justify-center rounded-full bg-leaf" role="img" aria-label="Sent">
              <CheckIcon className="size-16 text-paper" strokeWidth={3} aria-hidden />
            </div>
            <p className="mt-5 font-sans text-lg font-bold">Sent to {circle.name}.</p>
            <p className="mt-1 font-serif text-base text-soft">
              Its members will write back to you at <span className="text-ink">{email.trim()}</span>.
            </p>
            <ButtonLink href={`/wiki/${circle.id}`} className="mt-6 w-full justify-center text-center">
              Back to the wiki
            </ButtonLink>
          </div>
        </Modal>
      )}
    </div>
  );
}
