"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  className: string;
  children: ReactNode;
}

/* Shared modal shell: full-screen dim overlay, top-anchored (not vertically
   centered) so content taller than the viewport scrolls instead of being
   clipped — see ProfileModal, which needed exactly this before this
   component existed. Clicking the overlay dismisses; clicking inside the
   box doesn't propagate. `className` sets the box's own width (e.g.
   `max-w-110`) — required, not defaulted, since a caller-supplied max-w-*
   class can't reliably beat one already baked in here without
   tailwind-merge (see FloatingActionButton's own note on this).
   overscroll-contain keeps a scroll that reaches the overlay's end from
   carrying on into the page behind it, which in the installed app is
   AppShell's <main>, the modal's own ancestor. ConfirmModal and ProfileModal
   do the same. */
export function Modal({ onClose, className, children }: ModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/55 px-5 pt-15"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx("w-full border border-ink bg-paper shadow-[8px_8px_0_rgba(10,10,10,1)]", className)}
      >
        {children}
      </div>
    </div>
  );
}
