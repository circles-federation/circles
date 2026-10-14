"use client";

import type { ReactNode } from "react";
import { ArrowUpOnSquareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Modal } from "./modal";

/* How to install Circles on an iPhone, which has no install API: Share, then
   Add to Home Screen. The last step says to sign in there, since the
   installed app keeps its own cookies apart from Safari's. Shown from the
   welcome page and from Home's install prompt. */
export function InstallStepsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} className="max-w-110" title="Install Circles">
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
