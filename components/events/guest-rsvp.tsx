"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Button, ButtonLink, ConfirmModal, Input, Label, Modal } from "@/components/shared";
import { cancelGuestRsvpAction, confirmGuestRsvpAction, resendGuestRsvpCodeAction, startGuestRsvpAction } from "@/lib/guest-rsvp";
import { GUEST_NAME_MAX } from "@/lib/guest-rsvp.util";

type Step = "form" | "code" | "done";

interface GuestRsvpProps {
  token: string;
  // this browser's confirmed RSVP, if it has one
  guest: { id: string; name: string } | null;
}

/* The public event page's RSVP: the button, and the dialog it opens that asks
   for a name and an email address, checks the address with an emailed code, and
   ends on a green check with the way into Circles (applying). Once this browser
   has RSVPed the button says so and can take it back. */
export function GuestRsvp({ token, guest }: GuestRsvpProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function close() {
    setOpen(false);
    // the page's list and button now show the RSVP
    if (step === "done") router.refresh();
  }

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await startGuestRsvpAction(token, name, email);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setId(result.id);
    setDevCode(result.code ?? null);
    setStep("code");
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await confirmGuestRsvpAction(id, code);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setStep("done");
  }

  async function handleResend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await resendGuestRsvpCodeAction(id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDevCode(result.code ?? null);
  }

  async function handleCancel() {
    if (!guest || busy) return;
    setBusy(true);
    const result = await cancelGuestRsvpAction(guest.id);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div>
      {guest ? (
        /* a status, not a control: plain green text with a check, so nothing
           about it looks pressable; taking the RSVP back is the button beside it */
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-sans text-base font-bold text-leaf">
            <CheckIcon className="size-5" strokeWidth={3} aria-hidden />
            You&apos;re going
          </span>
          <Button variant="secondary" size="compact" onClick={() => setConfirmingCancel(true)} disabled={busy}>
            Cancel RSVP
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => {
            setStep("form");
            setError(null);
            setOpen(true);
          }}
        >
          RSVP
        </Button>
      )}
      {error && !open && <p className="mt-2 font-sans text-xs font-bold text-danger">{error}</p>}

      {confirmingCancel && (
        <ConfirmModal
          title="Cancel your RSVP?"
          message="Your name will come off the list of who's going. You can RSVP again any time before the event."
          confirmLabel="Cancel RSVP"
          cancelLabel="Keep RSVP"
          onCancel={() => setConfirmingCancel(false)}
          onConfirm={() => {
            setConfirmingCancel(false);
            handleCancel();
          }}
        />
      )}

      {open && (
        <Modal onClose={close} className="max-w-110" title={step === "done" ? "You're going" : "RSVP"}>
          <div className="px-6 pt-2 pb-6">
            {step === "form" && (
              <form onSubmit={handleStart}>
                <p className="mb-4 font-serif text-base leading-normal text-body">No account needed. We&apos;ll email you a code to check the address is yours.</p>
                <p className="mb-4 font-serif text-sm leading-normal text-soft">
                  Your first name will show on the list of who&apos;s going. Your email is shown to no one. See the{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">
                    privacy notes
                  </a>
                  .
                </p>
                <Label htmlFor="guest-name">Your name</Label>
                <Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={GUEST_NAME_MAX} autoComplete="name" autoFocus />
                <Label htmlFor="guest-email" className="mt-4 block">
                  Email
                </Label>
                <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
                {error && <p className="mt-3 font-sans text-xs font-bold text-danger">{error}</p>}
                <Button type="submit" disabled={busy || !name.trim() || !email.trim()} className="mt-5 w-full">
                  {busy ? "Sending…" : "Send code"}
                </Button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={handleConfirm}>
                <p className="mb-4 font-serif text-base leading-normal text-body">
                  We sent a code to <strong className="text-ink">{email.trim()}</strong>. Enter it to RSVP.
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
                  {busy ? "Checking…" : "RSVP"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleResend} disabled={busy} className="mt-3 w-full">
                  Send a new code
                </Button>
              </form>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center text-center">
                <div className="flex size-28 items-center justify-center rounded-full bg-leaf" role="img" aria-label="Confirmed">
                  <CheckIcon className="size-16 text-paper" strokeWidth={3} aria-hidden />
                </div>
                <p className="mt-5 font-sans text-lg font-bold">You&apos;re going, {name.trim().split(/\s+/)[0]}.</p>
                <p className="mt-1 font-serif text-base text-soft">Your name is on the list.</p>
                <ButtonLink href={`/apply?guest=${id}`} className="mt-6 w-full justify-center text-center">
                  Apply to join Circles
                </ButtonLink>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
