"use client";

/* ------------------------------------------------------------------ */
/*  Reusable toast system. A provider sits high in the tree and any   */
/*  component can fire a toast via useToast(). Built to be reused for  */
/*  confirmations, errors, etc.                                       */
/* ------------------------------------------------------------------ */
import { createContext, useCallback, useContext, useState } from "react";
import { useIsMobile } from "@/lib/hooks";
import { INK, LEAF, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  // no-op fallback if used outside a provider, so callers never crash
  return ctx || { showToast: () => {} };
}

const TOAST_TONES = {
  success: { bar: LEAF, label: "Success" },
  error:   { bar: "#c0392b", label: "Something went wrong" },
  info:    { bar: INK, label: "Notice" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const isMobile = useIsMobile();

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
        style={{
          position: "fixed", zIndex: 1000,
          top: isMobile ? 0 : 16,
          left: isMobile ? 0 : "auto",
          right: isMobile ? 0 : 16,
          width: isMobile ? "100%" : "auto",
          maxWidth: isMobile ? "100%" : 380,
          display: "flex", flexDirection: "column", gap: 10,
          padding: isMobile ? 10 : 0,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const tone = TOAST_TONES[t.tone] || TOAST_TONES.info;
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                background: PAPER, color: INK,
                border: `1px solid ${INK}`, borderLeft: `5px solid ${tone.bar}`,
                boxShadow: "4px 4px 0 rgba(10,10,10,0.12)",
                padding: "14px 16px",
                display: "flex", alignItems: "flex-start", gap: 12,
                animation: "toastIn .18s ease-out",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.eyebrow, letterSpacing: "0.1em", textTransform: "uppercase", color: tone.bar }}>
                  {t.title || tone.label}
                </div>
                <div style={{ fontFamily: serif, fontSize: TYPE.sm, lineHeight: 1.45, marginTop: 4 }}>{t.message}</div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                style={{ background: "none", border: "none", cursor: "pointer", color: SOFT, fontSize: TYPE.lg, lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
