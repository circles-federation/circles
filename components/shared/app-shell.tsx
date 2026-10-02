"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type UIEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { registerServiceWorker } from "@/lib/push-client";
import { isInstalledApp } from "@/lib/viewport";
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
  useBlockEdgeSwipe();
  useBlockPinchZoom();
  useServiceWorker();
  useKeyboard(mainRef);

  // a tab tapped again while its page is showing: back to the top, whichever
  // of the document or <main> is what scrolls
  function scrollToTop() {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-dvh bg-paper pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-serif text-ink standalone:relative standalone:flex standalone:h-(--app-height) standalone:flex-col">
      <TopBar onReselect={scrollToTop} />

      <main
        ref={mainRef}
        onScroll={onScroll}
        className="max-[719px]:pb-[calc(var(--bottom-nav-gap)+4.75rem)] standalone:flex-1 standalone:overflow-y-auto standalone:pt-(--top-bar-height) standalone:scroll-pt-(--top-bar-height)"
      >
        {children}
        <div aria-hidden className="h-(--keyboard-room)" />
      </main>

      <BottomNav onReselect={scrollToTop} />
    </div>
  );
}

/* Registers the service worker (public/sw.js, there for push notifications),
   and follows a tapped notification: the worker asks an already-open window
   to go to what it's about, which is done here through the router rather
   than by reloading the page. */
function useServiceWorker() {
  const router = useRouter();
  useEffect(() => {
    registerServiceWorker().catch((err) => console.error("Couldn't register the service worker:", err));
    if (!("serviceWorker" in navigator)) return;
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; path?: unknown } | null;
      if (data?.type === "open" && typeof data.path === "string" && data.path.startsWith("/")) router.push(data.path);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
}

const FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable]";
// how far below TopBar a field being typed in sits
const FIELD_MARGIN_PX = 24;
// a field lower than this share of the screen would end up under the keyboard
const KEYBOARD_LINE = 0.4;

/* Installed as an app, the iOS keyboard doesn't make the page any shorter:
   Safari slides the whole screen up to keep the field being typed in above
   it, TopBar and all. It only slides when the field would end up under the
   keyboard, so the moment a field in <main> is focused (before the keyboard
   animates in) it's scrolled up to just below TopBar, with room added under
   the page (--keyboard-room) so a field near the end can go that high too.
   Then, once the keyboard is up, the shell is sized to what's still visible
   (the visual viewport, as --app-height), so <main> ends at the keyboard and
   the field stays in view as more is typed; any slide that happened anyway
   is undone. Both are put back once the keyboard is gone. Android already
   shrinks the page for its keyboard, so there this only confirms the height
   it has. A browser tab is left to the browser. */
function useKeyboard(mainRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const main = mainRef.current;
    if (!viewport || !main || !isInstalledApp()) return;
    const root = document.documentElement;
    // the visual viewport is as tall as the layout one unless something (the
    // keyboard) is covering it
    const keyboardUp = () => !!viewport && viewport.height < window.innerHeight - 1;

    function onFocusIn(e: FocusEvent) {
      const field = e.target;
      if (!(field instanceof HTMLElement) || !field.matches(FIELD) || !main?.contains(field)) return;
      root.style.setProperty("--keyboard-room", "60dvh");
      const rect = field.getBoundingClientRect();
      if (rect.bottom < window.innerHeight * KEYBOARD_LINE) return;
      const topBar = parseFloat(getComputedStyle(root).getPropertyValue("--top-bar-height")) || 0;
      main.scrollTop += rect.top - topBar - FIELD_MARGIN_PX;
    }

    // left every field with no keyboard showing (a hardware keyboard, say):
    // the room isn't needed. With the keyboard up, fit() takes it away once
    // the keyboard has gone, so the page doesn't jump while it's closing.
    function onFocusOut(e: FocusEvent) {
      const next = e.relatedTarget;
      if (!(next instanceof HTMLElement && next.matches(FIELD)) && !keyboardUp()) root.style.setProperty("--keyboard-room", "0px");
    }

    function fit() {
      if (!viewport) return;
      root.style.setProperty("--app-height", `${viewport.height}px`);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      // the keyboard's gone: no more room needed under the page
      if (!keyboardUp()) root.style.setProperty("--keyboard-room", "0px");
    }

    fit();
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--keyboard-room");
    };
  }, [mainRef]);
}

/* Installed as an app, pinching doesn't zoom, as in a native app. The CSS
   touch-action on html (app/globals.css) is the main way; this cancels
   Safari's own pinch gesture events too, for an iOS that doesn't honor that
   alone. Only when installed: a browser tab keeps its zoom. */
function useBlockPinchZoom() {
  useEffect(() => {
    if (!isInstalledApp()) return;
    const cancel = (e: Event) => e.preventDefault();
    // Safari-only events, so not in the DOM's typed event map
    document.addEventListener("gesturestart", cancel, { passive: false });
    document.addEventListener("gesturechange", cancel, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", cancel);
      document.removeEventListener("gesturechange", cancel);
    };
  }, []);
}

// how far in from the screen's left or right edge a touch starts iOS's
// swipe-back (or swipe-forward) gesture
const EDGE_SWIPE_PX = 20;

/* Installed as an app, iOS still offers its swipe-from-the-edge Back, but it
   slides a snapshot of the whole screen, TopBar and BottomNav included,
   rather than just the page as a native app does. Until there's a gesture of
   our own that moves only the content, it's turned off: a touch that starts
   at either edge is cancelled before iOS can take it as the gesture. Only
   when installed, since in a browser tab the swipe is the browser's own Back.
   The cost is that a tap starting that close to the edge does nothing. */
function useBlockEdgeSwipe() {
  useEffect(() => {
    if (!isInstalledApp()) return;
    function onTouchStart(e: TouchEvent) {
      const x = e.touches[0]?.clientX;
      if (x !== undefined && (x < EDGE_SWIPE_PX || x > window.innerWidth - EDGE_SWIPE_PX)) e.preventDefault();
    }
    // not passive: a passive listener can't cancel the touch
    document.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => document.removeEventListener("touchstart", onTouchStart);
  }, []);
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
