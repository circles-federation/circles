"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type UIEvent } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";

/* The chrome every authenticated route shares: the sticky top nav and the
   mobile bottom nav. Mounted once in app/(app)/layout.jsx so it doesn't
   remount on navigation. The button-press interaction styles it used to
   carry live in app/globals.css instead — global, not scoped here, since the
   unauthenticated welcome page needs them too and sits outside this tree.

   The side padding keeps content clear of a landscape phone's notch, and the
   bottom padding lets the end of the page scroll clear of the floating
   BottomNav and the home indicator beneath it (the insets are zero outside
   an installed app or on a phone without them).

   Installed as an app, the page no longer scrolls: <main> does, under a
   TopBar laid over its top that stays put while the content bounces (see
   `standalone` in app/globals.css, and TopBar for --top-bar-height, which
   pads <main> down clear of it). In a browser tab <main> is an ordinary
   block and the document scrolls as usual. */
export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const onScroll = useScrollRestoration(mainRef);

  // a tab tapped again while its page is showing: back to the top, whichever
  // of the document or <main> is what scrolls
  function scrollToTop() {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-dvh bg-paper pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-serif text-ink standalone:relative standalone:flex standalone:h-dvh standalone:flex-col">
      <TopBar onReselect={scrollToTop} />

      <main
        ref={mainRef}
        onScroll={onScroll}
        className="max-[719px]:pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] standalone:flex-1 standalone:overflow-y-auto standalone:pt-(--top-bar-height) standalone:scroll-pt-(--top-bar-height)"
      >
        {children}
      </main>

      <BottomNav onReselect={scrollToTop} />
    </div>
  );
}

/* The browser remembers where the document was scrolled for Back and
   Forward, but not an element like the installed app's <main>, so this does
   it for <main>: each page's position is kept as it scrolls, put back when
   Back or Forward returns to it, and a newly opened page starts at the top.
   In a browser tab <main> doesn't scroll, so none of it has any effect there
   and the browser's own restoring applies. */
function useScrollRestoration(ref: RefObject<HTMLElement | null>) {
  const pathname = usePathname();
  const [positions] = useState(() => new Map<string, number>());
  const renderedPath = useRef<string | null>(null);
  const pendingTraversal = useRef(false);

  /* React renders a Back or Forward synchronously inside the popstate event
     when it can, from Next's own listener — which runs before this one when
     AppShell mounted after the router did (signing in, say). So the restoring
     below also recognizes that it's running inside that event, and this only
     marks a traversal that hasn't been rendered yet. Marking one that has
     would leave the next ordinary navigation restoring instead of starting at
     the top. */
  useEffect(() => {
    const onPopState = () => {
      if (location.pathname !== renderedPath.current) pendingTraversal.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // a layout effect, so the page is never painted at the previous page's offset
  useLayoutEffect(() => {
    const traversal = pendingTraversal.current || window.event?.type === "popstate";
    pendingTraversal.current = false;
    renderedPath.current = pathname;
    if (ref.current) ref.current.scrollTop = traversal ? (positions.get(pathname) ?? 0) : 0;
  }, [pathname, positions, ref]);

  return (e: UIEvent<HTMLElement>) => positions.set(pathname, e.currentTarget.scrollTop);
}
