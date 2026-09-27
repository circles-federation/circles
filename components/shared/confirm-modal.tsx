"use client";

import type { ReactNode } from "react";
import { Modal } from "./modal";

interface ConfirmModalProps {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/* Generic "are you sure" dialog — currently only used to guard discarding
   unsaved changes, but kept content-agnostic (title/message/labels as
   props) rather than named after that one use, since any future form with
   a dirty check will want the same confirmation. */
export function ConfirmModal({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal onClose={onCancel} className="max-w-105" centered>
      <div className="p-6">
        <h2 className="font-sans text-lg font-extrabold tracking-tight m-0">{title}</h2>
        <p className="mt-2.5 font-serif text-sm leading-relaxed text-soft">{message}</p>
      </div>
      <div className="flex border-t border-ink">
        <button
          onClick={onCancel}
          className="btn-invert btn-ink flex-1 cursor-pointer border-r border-ink bg-ink py-3.5 font-sans text-xs font-bold uppercase tracking-wide text-paper"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className="ink-press flex-1 cursor-pointer bg-paper py-3.5 font-sans text-xs font-bold uppercase tracking-wide text-danger"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
