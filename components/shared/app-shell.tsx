"use client";

import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";

/* The chrome every authenticated route shares: the sticky top nav and the
   mobile bottom nav. Mounted once in app/(app)/layout.jsx so it doesn't
   remount on navigation. The button-press interaction styles it used to
   carry live in app/globals.css instead — global, not scoped here, since the
   unauthenticated welcome page needs them too and sits outside this tree.

   The side padding keeps content clear of a landscape phone's notch, and the
   bottom padding clears BottomNav plus the home indicator beneath it (both
   zero outside an installed app or on a phone without them). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-serif text-ink max-[719px]:pb-[calc(4.6875rem+env(safe-area-inset-bottom))]">
      <TopBar />

      {children}

      <BottomNav />
    </div>
  );
}
