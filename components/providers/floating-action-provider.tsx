"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject, type SVGProps } from "react";

export interface FloatingAction {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onAction: () => void;
}

type Shown = Omit<FloatingAction, "onAction">;

/* A page's floating action button (see FloatingActionButton): the page says
   what it is with useFloatingAction, and the app's chrome draws it where it
   belongs for the screen — AppShell above the bottom nav on a phone,
   SimpleTabs at the end of the page's tab row wider — so no page places one
   itself. Built like useTopBarAction: what's shown is state, so the chrome
   re-renders when it changes; the handler is a ref, re-registered every
   render, so it always sees the page's current state. */
const ShownContext = createContext<{ shown: Shown | null; setShown: (shown: Shown | null) => void } | null>(null);
const HandlerContext = createContext<RefObject<(() => void) | null> | null>(null);

export function FloatingActionProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const handler = useRef<(() => void) | null>(null);
  return (
    <ShownContext.Provider value={{ shown, setShown }}>
      <HandlerContext.Provider value={handler}>{children}</HandlerContext.Provider>
    </ShownContext.Provider>
  );
}

// null shows none; it goes away with the page, or when the page asks for none
export function useFloatingAction(action: FloatingAction | null) {
  const handlerRef = useContext(HandlerContext);
  const setShown = useContext(ShownContext)?.setShown;

  useEffect(() => {
    if (!handlerRef || !action) return;
    const onAction = action.onAction;
    handlerRef.current = onAction;
    return () => {
      if (handlerRef.current === onAction) handlerRef.current = null;
    };
  });

  const label = action?.label;
  const icon = action?.icon;
  useEffect(() => {
    if (!setShown || !label || !icon) return;
    setShown({ label, icon });
    return () => setShown(null);
  }, [setShown, label, icon]);
}

// for AppShell and SimpleTabs: the current page's floating action, if any, and a way to run it
export function useCurrentFloatingAction(): { shown: Shown | null; run: () => void } {
  const shown = useContext(ShownContext)?.shown ?? null;
  const handlerRef = useContext(HandlerContext);
  return { shown, run: () => handlerRef?.current?.() };
}
