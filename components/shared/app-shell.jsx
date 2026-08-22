"use client";

import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";
import { INK, PAPER, serif } from "@/lib/theme";

/* The chrome every authenticated route shares: the sticky top nav and the
   mobile bottom nav. Mounted once in app/(app)/layout.jsx so it doesn't
   remount on navigation. The button-press interaction styles it used to
   carry live in app/globals.css instead — global, not scoped here, since the
   unauthenticated welcome page needs them too and sits outside this tree. */
export function AppShell({ children }) {
  return (
    <div
      className="max-[719px]:pb-18.75"
      style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: serif }}
    >
      <TopBar />

      {children}

      <BottomNav />
    </div>
  );
}
