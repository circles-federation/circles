"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UsersIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow, FloatingActionButton, Input, Label, Modal, OfflineBanner, useToast } from "@/components/shared";
import { requestLoginCode, verifyLoginCode } from "@/lib/auth";
import { InstallPrompt } from "./install-prompt";
import { EMAIL_SHAPE } from "@/lib/applications.util";
import type { Member } from "@/lib/types";

type Step = "email" | "code";

interface WelcomePageProps {
  // members with an email, handed in by the server (this page is outside
  // AppStateProvider, so it can't read the roster from app state); empty in
  // production, which hides the demo-accounts button
  demoMembers: Member[];
}

/* The unauthenticated welcome page — passwordless email + one-time-code
   login. The code is emailed; outside production requestLoginCode() also
   hands it straight back, shown here as an explicit "dev mode" hint; the
   Server Actions themselves never navigate (matching this app's existing
   convention that mutators are pure state, callers do the routing) — this
   form calls router.push() itself once verifyLoginCode() succeeds.

   The floating "Demo accounts" button is dev/demo scaffolding, not a real
   product feature — it exists so someone showing the app off knows which
   emails are actually signed-in-able, since there's no real account list to
   check against yet. */
export function WelcomePage({ demoMembers: demoMembersProp }: WelcomePageProps) {
  const router = useRouter();
  const { showToast } = useToast();
  // only members with an email can actually be signed in as — see lib/db/members.ts's getMemberByEmail
  const demoMembers = [...demoMembersProp].sort((a, b) => a.name.localeCompare(b.name));
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const emailValid = EMAIL_SHAPE.test(email.trim());
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    if (!emailValid || busy) return;
    setBusy(true);
    const result = await requestLoginCode(email);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't send a code", message: result.error });
      return;
    }
    setDevCode(result.code || null);
    setStep("code");
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const result = await verifyLoginCode(email, code);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't verify that code", message: result.error });
      return;
    }
    router.push("/home");
  }

  function useDifferentEmail() {
    setStep("email");
    setCode("");
    setDevCode(null);
  }

  function selectDemoMember(m: Member) {
    setEmail(m.email || "");
    setCode("");
    setDevCode(null);
    setStep("email");
    setDemoOpen(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6 py-16">
      <OfflineBanner className="fixed inset-x-0 top-0 z-50 pt-[calc(0.5rem+env(safe-area-inset-top))]" />
      <div className="w-full max-w-md">
        <div className="border-t-[3px] border-t-ink pt-4.5">
          <Eyebrow className="text-soft">Welcome to</Eyebrow>
          <h1 className="mt-3 font-sans text-hero font-extrabold tracking-[-0.04em] leading-[0.9]">
            Circles
          </h1>
          <p className="mt-3.5 mb-7 font-serif text-lg leading-normal text-[#222]">
            Sign in with your email to connect with your community.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode}>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@duck.com"
              autoComplete="email"
              enterKeyHint="send"
              autoFocus
              required
            />
            <Button type="submit" disabled={busy || !emailValid} className="mt-4 w-full">
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p className="mb-4 font-serif text-sm text-soft">
              We sent a code to <strong className="text-ink">{email}</strong>.
            </p>
            {devCode && (
              <div className="mb-4 border border-dashed border-soft px-3 py-2.5 font-sans text-sm text-soft">
                Dev mode — here&apos;s your code (production only emails it):{" "}
                <strong className="tracking-[0.08em] text-ink">{devCode}</strong>
              </div>
            )}
            <Label htmlFor="code">One-time code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="tracking-[0.2em]"
              autoFocus
              inputMode="numeric"
              // iOS offers the emailed code above the keyboard
              autoComplete="one-time-code"
              enterKeyHint="go"
              required
            />
            <Button type="submit" disabled={busy || code.trim().length !== 6} className="mt-4 w-full">
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <Button type="button" variant="secondary" onClick={useDifferentEmail} className="mt-3 w-full">
              Use a different email
            </Button>
          </form>
        )}

        {step === "email" && (
          <p className="mt-6 font-serif text-base text-soft">
            New to Circles?{" "}
            <Link href="/apply" className="font-sans text-sm font-bold text-ink underline underline-offset-2">Apply to join</Link>
          </p>
        )}

        <InstallPrompt />
      </div>

      {demoMembers.length > 0 && (
        // outside the app, so it places itself: the bottom-right corner, clear
        // of the home indicator
        <FloatingActionButton
          onClick={() => setDemoOpen(true)}
          label="Demo accounts"
          icon={UsersIcon}
          className="fixed right-6 bottom-[calc(24px+env(safe-area-inset-bottom))] z-40"
        />
      )}

      {demoOpen && (
        <Modal onClose={() => setDemoOpen(false)} className="max-w-110" title="Demo accounts">
          <p className="border-b border-faint px-4.5 py-3 font-serif text-sm text-soft">Tap a name to fill in their email.</p>
          <div className="max-h-[60vh] overflow-y-auto">
            {demoMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => selectDemoMember(m)}
                className="ink-press flex w-full items-baseline justify-between gap-3 border-b border-faint bg-paper cursor-pointer px-4.5 py-3 text-left"
              >
                <span className="font-sans text-sm font-bold whitespace-nowrap">{m.name}</span>
                <span className="overflow-hidden font-serif text-sm text-ellipsis text-soft">{m.email}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
