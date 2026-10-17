"use client";

/* ------------------------------------------------------------------ */
/*  Reusable toast system. A provider sits high in the tree and any   */
/*  component can fire a toast via useToast(). Built to be reused for  */
/*  confirmations, errors, etc.                                       */
/* ------------------------------------------------------------------ */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { GhostIconButton } from "./ghost-icon-button";

type ToastTone = "success" | "error" | "info";

export interface ToastOptions {
  message?: string;
  title?: string;
  tone?: ToastTone;
  duration?: number;
}

interface Toast {
  id: string;
  message: string;
  title: string | null;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  showToast: (arg: string | ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): Pick<ToastContextValue, "showToast"> {
  const ctx = useContext(ToastContext);
  // no-op fallback if used outside a provider, so callers never crash
  return ctx || { showToast: () => "" };
}

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `border-l-${tone}`
const TOAST_TONES: Record<ToastTone, { border: string; text: string; label: string }> = {
  success: { border: "border-l-leaf", text: "text-leaf", label: "Success" },
  error: { border: "border-l-danger", text: "text-danger", label: "Something went wrong" },
  info: { border: "border-l-ink", text: "text-ink", label: "Notice" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((arg: string | ToastOptions) => {
    const opts: ToastOptions = typeof arg === "string" ? { message: arg } : (arg || {});
    const id = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
    const toast: Toast = {
      id,
      message: opts.message || "",
      title: opts.title || null,
      tone: opts.tone || "success",
      duration: opts.duration == null ? 20000 : opts.duration,
    };
    setToasts((prev) => [...prev, toast]);
    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration);
    }
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        // beneath the top bar, whose height it publishes as --top-bar-height
        // (the notch included); where there's no bar (the welcome page), below
        // the notch instead
        className="pointer-events-none fixed top-[calc(var(--top-bar-height,env(safe-area-inset-top))+0.625rem)] right-0 left-0 z-1000 flex w-full max-w-full flex-col gap-3 px-3 min-[720px]:top-[calc(var(--top-bar-height,env(safe-area-inset-top))+1rem)] min-[720px]:right-4 min-[720px]:left-auto min-[720px]:w-auto min-[720px]:max-w-95 min-[720px]:px-0"
      >
        {toasts.map((t) => {
          const tone = TOAST_TONES[t.tone] || TOAST_TONES.info;
          return (
            <div
              key={t.id}
              className={clsx(
                // floating chrome, like a dialog: no outline, the bottom nav's
                // soft shadow, and its tone as a rule down the left
                "pointer-events-auto flex items-start gap-1 border-l-[5px] bg-paper py-4 pr-1.5 pl-4 text-ink shadow-overlay animate-[toastIn_var(--motion-screen)_var(--ease-enter)]",
                tone.border,
              )}
            >
              <div className="min-w-0 flex-1">
                <div className={clsx("font-sans text-eyebrow font-extrabold tracking-caps uppercase", tone.text)}>
                  {t.title || tone.label}
                </div>
                <div className="mt-1 font-serif text-sm leading-[1.45]">{t.message}</div>
              </div>
              {/* the modals' close button; -my-2 keeps its tap area from
                  making the toast taller */}
              <GhostIconButton icon={XMarkIcon} label="Dismiss" onClick={() => dismiss(t.id)} className="-my-2" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
