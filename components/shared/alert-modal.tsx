"use client";

import { useEffect, type ReactNode } from "react";

interface AlertModalProps {
  title: ReactNode;
  message: ReactNode;
  onClose: () => void;
}

/* A dialog that only tells you something — ConfirmModal's one-button
   sibling, in the same shape, for when there's nothing to choose between
   (why the name game can't start, say). OK, a tap outside it, or Escape all
   close it. */
export function AlertModal({ title, message, onClose }: AlertModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto overscroll-contain bg-ink/55 px-5"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-105 border border-ink bg-paper shadow-[8px_8px_0_rgba(10,10,10,1)]"
      >
        <div className="p-6">
          <h2 className="m-0 font-sans text-lg font-extrabold tracking-tight">{title}</h2>
          <p className="mt-2.5 font-serif text-sm leading-relaxed text-soft">{message}</p>
        </div>
        <div className="flex border-t border-ink">
          <button
            onClick={onClose}
            autoFocus
            className="btn-invert btn-ink flex-1 cursor-pointer bg-ink py-3.5 font-sans text-xs font-bold uppercase tracking-wide text-paper"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
