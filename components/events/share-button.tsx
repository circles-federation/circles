"use client";

import { useEffect, useState } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { ConfirmModal, Modal, Button, useToast } from "@/components/shared";
import { createShareLinkAction, getShareStatusAction, revokeShareLinksAction } from "@/lib/db/actions";
import type { ShareStatus } from "@/lib/db/event-shares";
import { isPhoneWidth } from "@/lib/viewport";

interface ShareButtonProps {
  eventId: string;
  title: string;
}

type Scope = "mine" | "all";

const CONFIRM: Record<Scope, { title: string; message: string; confirmLabel: string; cancelLabel: string }> = {
  mine: {
    title: "Stop sharing your link?",
    message: "Your link to this event will stop working. People who already RSVPed stay on the list, and you can share again for a new link.",
    confirmLabel: "Stop sharing",
    cancelLabel: "Keep link",
  },
  all: {
    title: "Stop all sharing of this event?",
    message: "Every link to this event, other members' included, will stop working. People who already RSVPed stay on the list, and members can share again for new links.",
    confirmLabel: "Stop all links",
    cancelLabel: "Keep links",
  },
};

/* Sends someone without an account this event's public page (/e/[token]):
   the phone's share sheet on a phone, otherwise (desktop browsers included,
   some of which have a share sheet of their own) the link is copied.
   The link is this member's own, so whoever it's sent to can be traced back
   to them if they apply. Beside it, once there's a link to stop, "Stop
   sharing": the member's own, and for whoever manages the event every link to
   it. Either asks first, and leaves those already going on the list. */
export function ShareButton({ eventId, title }: ShareButtonProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  // the chooser (when both are on offer), then the confirmation for one
  const [step, setStep] = useState<"choose" | Scope | null>(null);

  useEffect(() => {
    let current = true;
    getShareStatusAction(eventId).then((r) => {
      if (current && r.ok) setStatus(r.value);
    });
    return () => {
      current = false;
    };
  }, [eventId]);

  const canStopMine = !!status?.mine;
  const canStopAll = !!status?.canRevokeAll && (status.othersLive || status.mine);

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createShareLinkAction(eventId);
      if (!result.ok) {
        showToast({ message: result.error, tone: "error" });
        return;
      }
      setStatus((prev) => (prev ? { ...prev, mine: true } : prev));
      const url = `${window.location.origin}/e/${result.value}`;
      if (isPhoneWidth() && navigator.share) {
        try {
          await navigator.share({ title, url });
        } catch {
          // closing the share sheet isn't a failure
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
      } catch {
        showToast({ message: "Couldn't copy the link. Your browser blocked it.", tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStop(scope: Scope) {
    setStep(null);
    setBusy(true);
    const result = await revokeShareLinksAction(eventId, scope);
    setBusy(false);
    if (!result.ok) {
      showToast({ message: result.error, tone: "error" });
      return;
    }
    setStatus((prev) => (prev ? { ...prev, mine: false, othersLive: scope === "all" ? false : prev.othersLive } : prev));
    showToast(scope === "all" ? "All links stopped" : "Link stopped");
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        onClick={handleShare}
        disabled={busy}
        className="ink-press inline-flex cursor-pointer items-center justify-center gap-1.5 border border-ink bg-paper px-4 py-3 font-sans text-xs font-bold tracking-caps whitespace-nowrap text-ink uppercase"
      >
        <ArrowUpTrayIcon className="size-4" strokeWidth={2} />
        Share
      </button>
      {(canStopMine || canStopAll) && (
        <button
          onClick={() => setStep(canStopMine && canStopAll ? "choose" : canStopAll ? "all" : "mine")}
          disabled={busy}
          className="hit cursor-pointer border-none bg-transparent p-0 font-sans text-sm font-bold text-ink underline underline-offset-2"
        >
          Stop sharing
        </button>
      )}

      {step === "choose" && (
        <Modal onClose={() => setStep(null)} className="max-w-105" title="Stop sharing">
          <div className="px-6 pt-2 pb-6">
            <p className="font-serif text-base leading-normal text-body">People who already RSVPed stay on the list either way.</p>
            <Button onClick={() => setStep("mine")} className="mt-5 w-full">
              Stop my link
            </Button>
            <Button variant="danger" onClick={() => setStep("all")} className="mt-3 w-full">
              Stop every link to this event
            </Button>
          </div>
        </Modal>
      )}
      {(step === "mine" || step === "all") && (
        <ConfirmModal {...CONFIRM[step]} onCancel={() => setStep(null)} onConfirm={() => handleStop(step)} />
      )}
    </div>
  );
}
