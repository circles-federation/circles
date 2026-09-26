"use client";

import { useEffect } from "react";

// what gets a pressed look: tiles, cards and outlined buttons (ink-press),
// filled buttons (btn-invert), and images (press-invert) — see the press
// styles in app/globals.css
const PRESSABLE = ".ink-press, .btn-invert, .press-invert";
// a touch has to be held this long, without moving, before it looks pressed,
// so the start of a scroll never flashes a tile
const TOUCH_DELAY_MS = 80;
// how far a finger can drift and still be a press rather than a scroll
const MOVE_SLOP_PX = 8;
// how long a tap too quick for the delay still shows its pressed look
const QUICK_TAP_FLASH_MS = 100;

/* The pressed look (a tile inverting to ink, a button to paper) used to be
   :active, which iOS applies the moment a finger lands — including the first
   instant of a scroll, so dragging across a grid of tiles flashed one. This
   marks the pressed element with data-pressed instead, the way a native app
   highlights: for touch, only once the finger has stayed put for a moment,
   and not at all once it moves, the browser takes the touch over to scroll
   (pointercancel), or the page scrolls; a tap lifted before then still
   flashes briefly. A mouse presses at once, as :active did. Mounted once, in
   the root layout, so the welcome page's buttons get it too. */
export function PressFeedback() {
  useEffect(() => {
    // the press in progress: where it started, and its delay while it's not
    // showing yet
    let press: { el: Element; x: number; y: number; timer: number | null } | null = null;

    function show(el: Element) {
      el.setAttribute("data-pressed", "");
    }

    function end() {
      if (!press) return;
      if (press.timer !== null) window.clearTimeout(press.timer);
      press.el.removeAttribute("data-pressed");
      press = null;
    }

    function onPointerDown(e: PointerEvent) {
      end();
      // a control of its own inside a pressable card (a bulletin card's edit
      // and remove) doesn't press the card
      if (e.target instanceof Element && e.target.closest("[data-press-ignore]")) return;
      const el = e.target instanceof Element ? e.target.closest(PRESSABLE) : null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      if (e.pointerType !== "touch") {
        press = { el, x: e.clientX, y: e.clientY, timer: null };
        return show(el);
      }
      const timer = window.setTimeout(() => {
        if (press?.el !== el) return;
        press.timer = null;
        show(el);
      }, TOUCH_DELAY_MS);
      press = { el, x: e.clientX, y: e.clientY, timer };
    }

    // a finger that drifts is scrolling, not pressing
    function onPointerMove(e: PointerEvent) {
      if (press && e.pointerType === "touch" && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_SLOP_PX) end();
    }

    function onPointerUp() {
      if (!press) return;
      const timer = press.timer;
      if (timer === null) return end();
      // a tap quicker than the delay: show it, briefly
      const tapped = press;
      window.clearTimeout(timer);
      tapped.timer = null;
      show(tapped.el);
      window.setTimeout(() => {
        if (press === tapped) end();
      }, QUICK_TAP_FLASH_MS);
    }

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", end, { passive: true });
    // capture, so a scroll inside AppShell's <main> counts as well as the page's
    document.addEventListener("scroll", end, { passive: true, capture: true });
    return () => {
      end();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", end);
      document.removeEventListener("scroll", end, { capture: true });
    };
  }, []);

  return null;
}
