"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpOnSquareIcon, EllipsisHorizontalIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow, Modal } from "@/components/shared";

// an iPhone browser tab, not the installed app. iOS has no install API (no
// beforeinstallprompt), so the best a page can do is walk someone through
// Add to Home Screen themselves.
function isIPhoneTab() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia("(display-mode: standalone)").matches;
  return /iPhone|iPod/.test(navigator.userAgent) && !standalone;
}

const noSubscribe = () => () => {};

/* Offers the installed app to someone on an iPhone before they sign in —
   before, because the installed app keeps its own cookies apart from
   Safari's, so a session started here wouldn't carry over to it. */
export function InstallPrompt() {
  // false on the server and during hydration, so the markup matches
  const show = useSyncExternalStore(noSubscribe, isIPhoneTab, () => false);
  const [open, setOpen] = useState(false);

  if (!show) return null;

  return (
    <>
      <div className="mt-10 border-t border-ink pt-4.5">
        <Eyebrow className="text-soft">On your iPhone?</Eyebrow>
        <p className="mt-2 mb-4 font-serif text-base leading-normal text-[#222]">
          Install Circles on your home screen to open it like any other app.
        </p>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <PlusCircleIcon className="size-5" strokeWidth={2} />
          Install the app
        </Button>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} className="max-w-110" title="Install Circles">
          <ol className="px-4.5 py-2 font-serif text-base leading-normal">
            <Step n={1}>
              Tap <strong className="font-sans">Share</strong>
              <ArrowUpOnSquareIcon className="mx-1 inline size-5 align-text-bottom" strokeWidth={2} aria-hidden />
              in your browser. In Safari it may be under the
              <EllipsisHorizontalIcon className="mx-1 inline size-5 align-text-bottom" strokeWidth={2} aria-hidden />
              button.
            </Step>
            <Step n={2}>
              Scroll down and tap <strong className="font-sans">Add to Home Screen</strong>, then <strong className="font-sans">Add</strong>.
            </Step>
            <Step n={3}>
              Open Circles from your home screen and sign in there.
            </Step>
          </ol>
        </Modal>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3.5 border-b border-faint py-3 last:border-b-0">
      <span className="flex size-6 shrink-0 items-center justify-center bg-ink font-sans text-xs font-bold text-paper">{n}</span>
      <span>{children}</span>
    </li>
  );
}
