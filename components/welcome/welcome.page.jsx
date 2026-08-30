"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow, FloatingActionButton, Input, Label, Modal, useToast } from "@/components/shared";
import { requestLoginCode, verifyLoginCode } from "@/lib/auth";
import { MEMBERS } from "@/lib/data";

// only members with an email can actually be signed in as — see lib/db/members.js's getMemberByEmail
const DEMO_MEMBERS = MEMBERS.filter((m) => m.email).sort((a, b) => a.name.localeCompare(b.name));

/* The unauthenticated welcome page — passwordless email + one-time-code
   login. No real email provider yet, so requestLoginCode() hands the code
   straight back and it's shown here as an explicit "dev mode" hint; the
   Server Actions themselves never navigate (matching this app's existing
   convention that mutators are pure state, callers do the routing) — this
   form calls router.push() itself once verifyLoginCode() succeeds.

   The floating "Demo accounts" button is dev/demo scaffolding, not a real
   product feature — it exists so someone showing the app off knows which
   emails are actually signed-in-able, since there's no real account list to
   check against yet. */
export function WelcomePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    const result = await requestLoginCode(email);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't send a code", message: result.error });
      return;
    }
    setDevCode(result.code);
    setStep("code");
  }

  async function handleVerify(e) {
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

  function selectDemoMember(m) {
    setEmail(m.email);
    setCode("");
    setDevCode(null);
    setStep("email");
    setDemoOpen(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <div className="border-t-[3px] border-t-ink pt-4.5">
          <Eyebrow className="text-soft">Welcome to</Eyebrow>
          <h1 className="mt-3 font-sans text-hero font-extrabold tracking-[-0.04em] leading-[0.9]">
            Providence
          </h1>
          <p className="mt-3.5 mb-7 font-serif text-lg leading-normal text-[#222]">
            A federation of neighborhoods and other organizations. Sign in with your email to get to your neighborhood.
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
              autoFocus
              required
            />
            <Button type="submit" disabled={busy} className="mt-4 w-full">
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
                Dev mode — there&apos;s no real email provider yet, so here&apos;s your code:{" "}
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
              required
            />
            <Button type="submit" disabled={busy} className="mt-4 w-full">
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <Button type="button" variant="secondary" onClick={useDifferentEmail} className="mt-3 w-full">
              Use a different email
            </Button>
          </form>
        )}
      </div>

      <FloatingActionButton
        onClick={() => setDemoOpen(true)}
        title="Demo accounts"
        icon={<UsersIcon className="size-5 text-ink" strokeWidth={2} />}
      />

      {demoOpen && (
        <Modal onClose={() => setDemoOpen(false)} className="max-w-110">
          <div className="flex items-center justify-between border-b border-ink px-4.5 py-3">
            <div>
              <Eyebrow className="text-soft">Demo accounts</Eyebrow>
              <p className="mt-1 font-serif text-sm text-soft">Tap a name to fill in their email.</p>
            </div>
            <button onClick={() => setDemoOpen(false)} aria-label="Close" className="ml-3 shrink-0 cursor-pointer bg-transparent p-0">
              <XMarkIcon className="size-5 text-ink" strokeWidth={2} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {DEMO_MEMBERS.map((m) => (
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
