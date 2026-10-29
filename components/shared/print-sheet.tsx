"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noSubscribe = () => () => {};

/* What a page prints instead of itself (a poster): put straight under <body>,
   apart from the app's bars and its scrolling <main>, which would otherwise
   print as well or cut it off at a screen's height. Shown only in print, and
   the rest of the page only on screen (`.print-sheet` in globals.css).
   Printing is always in the light theme, since the dark one is screen-only. */
export function PrintSheet({ children }: { children: ReactNode }) {
  // the portal needs the document, which the server render doesn't have
  const body = useSyncExternalStore(noSubscribe, () => document.body, () => null);
  return body ? createPortal(<div className="print-sheet">{children}</div>, body) : null;
}
