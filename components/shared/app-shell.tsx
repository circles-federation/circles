"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type UIEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { activeTab } from "@/lib/nav.util";
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
   an installed app or on a phone without them). BottomNav only shows on a
   page that belongs to one of its tabs (activeTab): a page for doing
   something, such as a form or Settings, is left by Back, as a native app's
   pushed screens are, so the nav slides away and the room for it goes.

   Installed as an app, the page no longer scrolls: <main> does, under a
   TopBar laid over its top that stays put while the content bounces (see
   `standalone` in app/globals.css, and TopBar for --top-bar-height, which
   pads <main> down clear of it). In a browser tab <main> is an ordinary
   block and the document scrolls as usual. */
export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const showNav = activeTab(usePathname()) !== null;
  const onScroll = useScrollRestoration(mainRef);
  useBlockEdgeSwipe();
  useBlockPinchZoom();
  useServiceWorker();
  useIosKeyboard(mainRef);

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
        className={clsx(
          showNav ? "max-[719px]:pb-[calc(var(--bottom-nav-gap)+4.75rem)]" : "max-[719px]:pb-[env(safe-area-inset-bottom)]",
          "standalone:flex-1 standalone:overflow-y-auto standalone:pt-(--top-bar-height) standalone:scroll-pt-(--top-bar-height)"
        )}
      >
        {children}
        <div aria-hidden className="h-(--keyboard-room)" />
      </main>

      <BottomNav onReselect={scrollToTop} away={!showNav} />
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

// fields that bring up the keyboard. Pickers (a select, a date) are left out:
// iOS only opens one for a real tap, not for focus().
const TYPED_FIELD = "textarea, [contenteditable], input:not([type]), input[type=text], input[type=search], input[type=email], input[type=url], input[type=tel], input[type=password], input[type=number]";
// how far below TopBar a field being typed in sits
const FIELD_MARGIN_PX = 24;
// a field lower than this share of the screen would end up under the keyboard
const KEYBOARD_LINE = 0.4;
// a touch that moved further than this was a scroll, not a tap
const TAP_SLOP_PX = 6;

// iOS, where the keyboard slides the page rather than shortening it (iPadOS
// reports itself as a Mac, but a Mac has no touchscreen)
function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function fieldAt(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const field = target.closest(TYPED_FIELD) ?? target.closest("label")?.control ?? null;
  return field instanceof HTMLElement && field.matches(TYPED_FIELD) ? field : null;
}

/* Installed as an app on iOS, the keyboard doesn't make the page any shorter:
   Safari slides the whole screen up to keep the field being typed in above
   it, TopBar and all. The viewport's interactiveWidget (app/layout.tsx) is
   the real fix, and does it on Android, but Safari doesn't support it yet, so
   this is Ionic's "scroll assist" until it does — then it can go.

   Safari decides whether to slide at the moment a field is focused, and only
   slides if the field would end up under the keyboard. So a tap on a field
   low in <main> is taken over before it focuses anything: room is added
   under the page (--keyboard-room) so even the last field can rise, <main> is
   scrolled to put the field just below TopBar, and only then is it focused —
   somewhere Safari has no reason to slide from. Once the keyboard is up the
   shell is sized to what's still visible (the visual viewport, as
   --app-height), so <main> ends at the keyboard and the field stays in view
   as more is typed, and any slide that happened anyway is undone. Both are
   put back once the keyboard is gone. */
function useIosKeyboard(mainRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const main = mainRef.current;
    if (!viewport || !main || !isInstalledApp() || !isIos()) return;
    const root = document.documentElement;
    // the visual viewport is as tall as the layout one unless something (the
    // keyboard) is covering it
    const keyboardUp = () => !!viewport && viewport.height < window.innerHeight - 1;
    let start: { x: number; y: number } | null = null;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      start = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    }

    function onTouchEnd(e: TouchEvent) {
      const t = e.changedTouches[0];
      const tapped = start && t && Math.hypot(t.clientX - start.x, t.clientY - start.y) <= TAP_SLOP_PX;
      start = null;
      const field = fieldAt(e.target);
      if (!tapped || !e.cancelable || !field || field === document.activeElement || !main?.contains(field)) return;
      if (field.matches(":disabled, [readonly]")) return;
      root.style.setProperty("--keyboard-room", "60dvh");
      const rect = field.getBoundingClientRect();
      // high enough already: the keyboard won't cover it, so nothing slides
      if (rect.bottom < window.innerHeight * KEYBOARD_LINE) return;
      // no native focus (or the click after it), which would slide the page
      e.preventDefault();
      const topBar = parseFloat(getComputedStyle(root).getPropertyValue("--top-bar-height")) || 0;
      main.scrollTop += rect.top - topBar - FIELD_MARGIN_PX;
      field.focus({ preventScroll: true });
      // a tap would have put the caret where it landed; at the end is the
      // nearest a programmatic focus can do (some input types can't be set)
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        try {
          field.setSelectionRange(field.value.length, field.value.length);
        } catch {}
      }
    }

    // left every field with no keyboard showing (a hardware keyboard, say):
    // the room isn't needed. With the keyboard up, fit() takes it away once
    // the keyboard has gone, so the page doesn't jump while it's closing.
    function onFocusOut(e: FocusEvent) {
      if (!fieldAt(e.relatedTarget) && !keyboardUp()) root.style.setProperty("--keyboard-room", "0px");
    }

    function fit() {
      if (!viewport) return;
      root.style.setProperty("--app-height", `${viewport.height}px`);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      if (!keyboardUp()) root.style.setProperty("--keyboard-room", "0px");
    }

    fit();
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    // not passive: a passive listener can't stop the native focus
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
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
