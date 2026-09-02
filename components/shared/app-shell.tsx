"use client";

import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";

/* The chrome every authenticated route shares: the sticky top nav and the
   mobile bottom nav. Mounted once in app/(app)/layout.jsx so it doesn't
   remount on navigation. The button-press interaction styles it used to
   carry live in app/globals.css instead — global, not scoped here, since the
   unauthenticated welcome page needs them too and sits outside this tree. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper font-serif text-ink max-[719px]:pb-18.75">
      <TopBar />

      {children}

      <BottomNav />
    </div>
  );
}
