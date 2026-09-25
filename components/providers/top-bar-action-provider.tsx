"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject, type SVGProps } from "react";

export interface TopBarAction {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onAction: () => void;
  disabled?: boolean;
  // "primary" makes it a primary icon button: the icon in a filled blue
  // circle (a faint outline while disabled), for the action the page is
  // there to do (Save). The default is a plain icon.
  variant?: "plain" | "primary";
}

type Shown = Omit<TopBarAction, "onAction">;

/* A page's own action for TopBar's right-hand slot, on every screen size:
   a form's Save lives there rather than on the page (Manage circle, the event
   form, Edit profile). Unlike TopBar's pageAction, which links somewhere, this runs
   the page's own code and reflects its state — disabled until there's
   something to save — so the page registers it with useTopBarAction. What's
   shown is state, so the bar re-renders when it changes; the handler is a
   ref, re-registered every render the way useBackHandler's is, so it always
   sees the page's current form state. The ref is a context of its own (and
   named as a ref where it's used), which is what lets React's lint rules
   accept writing to it, as in useBackHandler. */
const ShownContext = createContext<{ shown: Shown | null; setShown: (shown: Shown | null) => void } | null>(null);
const HandlerContext = createContext<RefObject<(() => void) | null> | null>(null);

export function TopBarActionProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const handler = useRef<(() => void) | null>(null);
  return (
    <ShownContext.Provider value={{ shown, setShown }}>
      <HandlerContext.Provider value={handler}>{children}</HandlerContext.Provider>
    </ShownContext.Provider>
  );
}

// null shows nothing; the page's action goes away with the page
export function useTopBarAction(action: TopBarAction | null) {
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
  const disabled = action?.disabled;
  const variant = action?.variant;
  useEffect(() => {
    if (!setShown || !label || !icon) return;
    setShown({ label, icon, disabled, variant });
    return () => setShown(null);
  }, [setShown, label, icon, disabled, variant]);
}

// for TopBar: the current page's action, if it registered one, and a way to run it
export function useCurrentTopBarAction(): { shown: Shown | null; run: () => void } {
  const shown = useContext(ShownContext)?.shown ?? null;
  const handlerRef = useContext(HandlerContext);
  return { shown, run: () => handlerRef?.current?.() };
}
