"use client";

import { useEffect, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { GhostIconButton } from "./ghost-icon-button";

interface ModalProps {
  onClose: () => void;
  // sets the box's own width (e.g. `max-w-110`)
  className: string;
  // shown in a header like the top bar's: the close button, then the title.
  // Left out, there's no header (ConfirmModal and AlertModal title their own
  // body and close from their buttons)
  title?: ReactNode;
  // a short dialog sits in the middle; a longer one is top-anchored, so
  // content taller than the viewport scrolls instead of being clipped
  centered?: boolean;
  role?: "dialog" | "alertdialog";
  // the header's action, on its right as the top bar's is (an
  // IconButtonCircle in ICON_BUTTON_SLOT): a picker's Choose
  action?: ReactNode;
  children: ReactNode;
}

/* The shell every dialog shares: a dimmed overlay, and a paper box floating
   over it with the same soft shadow as the app's other floating chrome (the
   bottom nav). A tap on the overlay or Escape closes it, like its close
   button. `className` is required, not defaulted, since a caller's max-w-*
   can't reliably beat one baked in here without tailwind-merge (see
   FloatingActionButton's own note on this). overscroll-contain keeps a scroll
   that reaches the overlay's end from carrying on into the page behind it,
   which in the installed app is AppShell's <main>, the modal's own ancestor. */
export function Modal({ onClose, className, title, centered, role = "dialog", action, children }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className={clsx(
        "fixed inset-0 z-100 flex justify-center overflow-y-auto overscroll-contain bg-scrim/40 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
        centered ? "items-center pt-[calc(1.25rem+env(safe-area-inset-top))]" : "items-start pt-[calc(3.75rem+env(safe-area-inset-top))]",
      )}
    >
      <div
        role={role}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={clsx("w-full bg-raised shadow-overlay", className)}
      >
        {title && (
          // laid out like the top bar: -ml-3 lines the X up with the edge,
          // as the bar's Back is
          <div className="flex h-14.5 items-center gap-1 border-b border-faint px-5">
            <GhostIconButton icon={XMarkIcon} label="Close" onClick={onClose} className="-ml-3" />
            <h2 className="m-0 min-w-0 flex-1 truncate font-sans text-lg font-extrabold tracking-heading">{title}</h2>
            {action}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
