"use client";

import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";
import { FLAME, INK, PAPER, TEAL, serif } from "@/lib/theme";

/* The chrome every route shares: the sticky top nav, the mobile bottom nav,
   and the ink-press/button interaction styles. Mounted once in the root
   layout around {children} so it doesn't remount on navigation. */
export function AppShell({ children }) {
  return (
    <div
      className="max-[719px]:pb-18.75"
      style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: serif }}
    >
      <style>{`
        .ink-press { transition: background 0.08s, color 0.08s; }
        .ink-press:active { background: ${INK} !important; color: ${PAPER} !important; }
        .ink-press:active * { color: ${PAPER} !important; border-color: ${PAPER} !important; }
        .ink-press:active span[style*="background"] { background: transparent !important; }
        .ink-press:active img { filter: grayscale(100%) invert(1) !important; }
        .btn-invert { transition: background 0.08s, color 0.08s; }
        .btn-ink:active { background: ${PAPER} !important; color: ${INK} !important; }
        .btn-teal:active { background: ${PAPER} !important; color: ${TEAL} !important; }
        .btn-teal:active * { color: ${TEAL} !important; }
        .btn-flame:active { background: ${PAPER} !important; color: ${FLAME} !important; }
        .btn-flame:active * { color: ${FLAME} !important; }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <TopBar />

      {children}

      <BottomNav />
    </div>
  );
}
