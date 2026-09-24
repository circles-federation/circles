"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";

type BackHandler = () => void;

/* TopBar's Back button is app chrome, mounted once above every route, so it
   can't know that a form has unsaved changes. A page that needs to intercept
   leaving (to ask before discarding edits) registers its own handler here
   with useBackHandler; TopBar calls it instead of navigating. Held in a ref,
   not state: only the button's click reads it, so registering a new closure
   on every render of the form shouldn't re-render the top bar. */
const BackHandlerContext = createContext<RefObject<BackHandler | null> | null>(null);

export function BackHandlerProvider({ children }: { children: ReactNode }) {
  const handler = useRef<BackHandler | null>(null);
  return <BackHandlerContext.Provider value={handler}>{children}</BackHandlerContext.Provider>;
}

// null leaves Back alone, so a form can intercept it only while it's dirty
export function useBackHandler(handler: BackHandler | null) {
  const ref = useContext(BackHandlerContext);
  // re-registered after every render so the button always runs the latest
  // closure (the one that sees current form state); the identity check keeps
  // an outgoing page's cleanup from clearing an incoming page's handler
  useEffect(() => {
    if (!ref || !handler) return;
    ref.current = handler;
    return () => {
      if (ref.current === handler) ref.current = null;
    };
  });
}

// for TopBar: runs the current page's handler if it registered one, and
// reports whether it did, so the caller falls back to plain navigation
export function useRunBackHandler(): () => boolean {
  const ref = useContext(BackHandlerContext);
  return () => {
    const handler = ref?.current;
    if (!handler) return false;
    handler();
    return true;
  };
}
