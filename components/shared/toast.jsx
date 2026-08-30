"use client";

/* ------------------------------------------------------------------ */
/*  Reusable toast system. A provider sits high in the tree and any   */
/*  component can fire a toast via useToast(). Built to be reused for  */
/*  confirmations, errors, etc.                                       */
/* ------------------------------------------------------------------ */
import { createContext, useCallback, useContext, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  // no-op fallback if used outside a provider, so callers never crash
  return ctx || { showToast: () => {} };
}

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `border-l-${tone}`
const TOAST_TONES = {
  success: { border: "border-l-leaf", text: "text-leaf", label: "Success" },
  error: { border: "border-l-danger", text: "text-danger", label: "Something went wrong" },
  info: { border: "border-l-ink", text: "text-ink", label: "Notice" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((arg) => {
    const opts = typeof arg === "string" ? { message: arg } : (arg || {});
    const id = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
    const toast = {
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
        className="pointer-events-none fixed top-0 right-0 left-0 z-1000 flex w-full max-w-full flex-col gap-2.5 p-2.5 min-[720px]:top-4 min-[720px]:right-4 min-[720px]:left-auto min-[720px]:w-auto min-[720px]:max-w-95 min-[720px]:p-0"
      >
        {toasts.map((t) => {
          const tone = TOAST_TONES[t.tone] || TOAST_TONES.info;
          return (
            <div
              key={t.id}
              className={clsx(
                // per-side classes on purpose: a shorthand like border-ink would
                // set border-left-color too, colliding with tone.border below in
                // a way Tailwind resolves by stylesheet order, not intent
                "pointer-events-auto flex items-start gap-3 border-t border-r border-b border-t-ink border-r-ink border-b-ink border-l-[5px] bg-paper px-4 py-3.5 text-ink shadow-[4px_4px_0_rgba(10,10,10,0.12)] animate-[toastIn_0.18s_ease-out]",
                tone.border,
              )}
            >
              <div className="min-w-0 flex-1">
                <div className={clsx("font-sans text-eyebrow font-extrabold tracking-wide uppercase", tone.text)}>
                  {t.title || tone.label}
                </div>
                <div className="mt-1 font-serif text-sm leading-[1.45]">{t.message}</div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-soft"
              >
                <XMarkIcon className="size-3.5" strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
