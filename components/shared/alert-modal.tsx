"use client";

import type { ReactNode } from "react";
import { Modal } from "./modal";
import { useActAfterPress } from "./press-feedback";

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
  const { pressed, act } = useActAfterPress<"ok">();
  return (
    <Modal onClose={onClose} className="max-w-105" centered role="alertdialog">
      <div className="p-6">
        <h2 className="m-0 font-sans text-lg font-extrabold tracking-tight">{title}</h2>
        <p className="mt-2.5 font-serif text-sm leading-relaxed text-soft">{message}</p>
      </div>
      <div className="flex border-t border-ink">
        <button
          onClick={() => act("ok", onClose)}
          data-pressed={pressed("ok")}
          autoFocus
          className="btn-invert btn-ink flex-1 cursor-pointer bg-ink py-3.5 font-sans text-xs font-bold uppercase tracking-wide text-paper"
        >
          OK
        </button>
      </div>
    </Modal>
  );
}
