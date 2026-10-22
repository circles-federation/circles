"use client";

import { useState } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/shared";
import { createShareLinkAction } from "@/lib/db/actions";
import { isPhoneWidth } from "@/lib/viewport";

interface ShareButtonProps {
  eventId: string;
  title: string;
}

/* Sends someone without an account this event's public page (/e/[token]):
   the phone's share sheet on a phone, otherwise (desktop browsers included,
   some of which have a share sheet of their own) the link is copied.
   The link is this member's own, so whoever it's sent to can be traced back
   to them if they apply. */
export function ShareButton({ eventId, title }: ShareButtonProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createShareLinkAction(eventId);
      if (!result.ok) {
        showToast({ message: result.error, tone: "error" });
        return;
      }
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

  return (
    <button
      onClick={handleShare}
      disabled={busy}
      className="ink-press inline-flex cursor-pointer items-center justify-center gap-1.5 border border-ink bg-paper px-4 py-3 font-sans text-xs font-bold tracking-caps whitespace-nowrap text-ink uppercase"
    >
      <ArrowUpTrayIcon className="size-4" strokeWidth={2} />
      Share
    </button>
  );
}
