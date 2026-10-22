"use client";

import { useState } from "react";
import { Button, Eyebrow } from "@/components/shared";
import { removeGuestRsvpAction, stopGuestEmailsAction } from "@/lib/guest-rsvp";

interface StopEmailsPageProps {
  id: string;
  title: string;
  // their way back to the event's page, if the link they came by still exists
  token: string | null;
  stopped: boolean;
}

type Outcome = "stopped" | "removed" | null;

/* Where the link at the foot of a guest's emails leads (outside the signed-in
   app, like the event page itself): stop hearing about this event while staying
   on its list, or come off the list and have their name and email deleted. */
export function StopEmailsPage({ id, title, token, stopped }: StopEmailsPageProps) {
  const [outcome, setOutcome] = useState<Outcome>(stopped ? "stopped" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (id: string) => ReturnType<typeof stopGuestEmailsAction>, next: Exclude<Outcome, null>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await action(id);
    setBusy(false);
    if (result.ok) setOutcome(next);
    else setError(result.error);
  }

  return (
    <div className="min-h-dvh bg-paper px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-20">
      <div className="mx-auto w-full max-w-110">
        <p className="font-sans text-sm font-extrabold tracking-[-0.02em]">Circles</p>
        <div className="mt-6 border-t-[3px] border-t-ink pt-5">
          <Eyebrow className="text-soft">Emails about</Eyebrow>
          <h1 className="mt-2 font-sans text-heading leading-[0.95] font-extrabold tracking-[-0.035em]">{title}</h1>

          {outcome === "removed" ? (
            <p className="mt-6 font-serif text-lg leading-normal text-body">You&apos;re off the list, and your name and email are deleted.</p>
          ) : outcome === "stopped" ? (
            <>
              <p className="mt-6 font-serif text-lg leading-normal text-body">You won&apos;t get any more emails about this event. You&apos;re still on the list of who&apos;s going.</p>
              {token && (
                <a href={`/e/${token}`} className="mt-4 inline-block font-sans text-sm font-bold text-ink underline underline-offset-2">
                  Back to the event
                </a>
              )}
            </>
          ) : (
            <>
              <p className="mt-6 font-serif text-lg leading-normal text-body">You RSVPed to this event, so we email you if it moves or is cancelled.</p>
              <Button onClick={() => run(stopGuestEmailsAction, "stopped")} disabled={busy} className="mt-6 w-full">
                Stop emails about this event
              </Button>
              <Button variant="secondary" onClick={() => run(removeGuestRsvpAction, "removed")} disabled={busy} className="mt-3 w-full">
                Take me off the list and delete my details
              </Button>
              {error && <p className="mt-3 font-sans text-xs font-bold text-danger">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
