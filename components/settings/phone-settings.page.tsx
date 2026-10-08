"use client";

import { useState } from "react";
import { CheckIcon, PaperAirplaneIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Button, ConfirmModal, Input, Label, PageContainer, Section, SectionGroup, useToast } from "@/components/shared";
import { SMS_CONSENT_NOTICE, formatPhone, formatTypedPhone, normalizePhone } from "@/lib/phone.util";

interface PhoneSettingsPageProps {
  // their confirmed number, if they have one
  phone?: string;
  onRequestCode: (phone: string) => Promise<{ ok: true; phone: string; code?: string } | { ok: false; error: string }>;
  onConfirm: (code: string) => Promise<MutationResult>;
  onRemove: () => Promise<MutationResult>;
  onBack: () => void;
}

type Step = "view" | "enter" | "code";

/* A member's mobile number, for text notifications. With one, it shows it,
   to change or remove; adding or changing one takes a texted code to confirm
   it's theirs, the top bar's action moving from Send code to Confirm, with the
   opt-in they're agreeing to shown above the field. Removing it stops all
   texts, behind a confirmation. */
export function PhoneSettingsPage({ phone, onRequestCode, onConfirm, onRemove, onBack }: PhoneSettingsPageProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>(phone ? "view" : "enter");
  const [typed, setTyped] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const valid = normalizePhone(typed);

  async function sendCode(number: string) {
    setBusy(true);
    setError(null);
    const result = await onRequestCode(number);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSentTo(result.phone);
    setDevCode(result.code ?? null);
    setCode("");
    setStep("code");
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await onConfirm(code);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    showToast({ tone: "success", title: "Number confirmed", message: `You'll get your notifications by text at ${formatPhone(sentTo ?? "")}.` });
    onBack();
  }

  async function remove() {
    setConfirmingRemove(false);
    setBusy(true);
    const result = await onRemove();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    showToast({ tone: "success", title: "Number removed", message: "You won't get any more texts from Circles." });
    onBack();
  }

  // a number typed, or a code on its way, is worth asking about before leaving
  const dirty = (step === "enter" && typed.trim() !== "") || step === "code";
  useBackHandler(dirty && !busy ? () => setConfirmingDiscard(true) : null);
  useTopBarAction(
    step === "enter"
      ? { label: busy ? "Sending" : "Send code", icon: PaperAirplaneIcon, onAction: () => valid && sendCode(typed), disabled: !valid || busy, variant: "primary" }
      : step === "code"
        ? { label: busy ? "Confirming" : "Confirm", icon: CheckIcon, onAction: confirm, disabled: code.trim().length !== 6 || busy, variant: "primary" }
        : null
  );

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Phone number) is the page's only heading */}
        <Section className="pt-0">
          {step === "view" && phone && (
            <>
              <Label>Your number</Label>
              <p className="font-sans text-xl font-extrabold tracking-[-0.01em]">{formatPhone(phone)}</p>
              <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">Your notifications are texted here. No one else sees it.</p>
              <Button variant="secondary" onClick={() => setStep("enter")} className="mt-5">
                Change number
              </Button>
            </>
          )}

          {step === "enter" && (
            <>
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" type="tel" value={typed} onChange={(e) => setTyped(formatTypedPhone(e.target.value))} placeholder="(401) 555-0123" autoComplete="tel" autoFocus />
              <p className="mt-3 max-w-[42em] border-l-2 border-ink pl-2.5 font-serif text-sm leading-normal text-[#222]">
                {SMS_CONSENT_NOTICE} We&apos;ll text a code to confirm it&apos;s yours.
              </p>
            </>
          )}

          {step === "code" && sentTo && (
            <>
              <p className="mb-4 max-w-[42em] font-serif text-lg leading-normal text-[#222]">
                We texted a code to <strong className="text-ink">{formatPhone(sentTo)}</strong>. Enter it here to confirm it&apos;s yours.
              </p>
              {devCode && (
                <div className="mb-4 border border-dashed border-soft px-3 py-2.5 font-sans text-sm text-soft">
                  Dev mode — here&apos;s your code (production only texts it): <strong className="tracking-[0.08em] text-ink">{devCode}</strong>
                </div>
              )}
              <Label htmlFor="code">Code from the text</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="tracking-[0.2em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              />
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button variant="secondary" size="compact" onClick={() => sendCode(sentTo)} disabled={busy}>
                  Send a new code
                </Button>
                <Button variant="secondary" size="compact" onClick={() => setStep("enter")} disabled={busy}>
                  Use a different number
                </Button>
              </div>
            </>
          )}

          {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}
        </Section>

        {/* removing: one-way, so apart from the rest, and asked about first */}
        {phone && step === "view" && (
          <Section>
            <Button variant="danger" onClick={() => setConfirmingRemove(true)} disabled={busy}>
              <TrashIcon className="size-3.5" strokeWidth={2.5} />
              Remove number
            </Button>
          </Section>
        )}
      </SectionGroup>

      {confirmingRemove && (
        <ConfirmModal
          title="Remove your number?"
          message="You'll stop getting notifications by text. You can add a number again any time."
          confirmLabel="Remove"
          cancelLabel="Keep it"
          onConfirm={remove}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}

      {confirmingDiscard && (
        <ConfirmModal
          title={phone ? "Keep your number as it is?" : "Leave without adding a number?"}
          message={phone ? `You'll keep getting texts at ${formatPhone(phone)}.` : "You won't get notifications by text until you add one."}
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
