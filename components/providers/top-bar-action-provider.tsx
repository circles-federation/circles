"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject, type SVGProps } from "react";
import type { TopBarMenuItem } from "@/components/shared/top-bar-menu";

export interface TopBarAction {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onAction: () => void;
  disabled?: boolean;
  // "primary" makes it a primary icon button: the icon in a filled blue
  // circle (a faint outline while disabled), for the action the page is
  // there to do (Save). "propose" is the same in orange, for a Save that
  // proposes the change for its circle's consent rather than making it
  // (Manage circle's Details and Roles). The default is a plain icon.
  variant?: "plain" | "primary" | "propose";
  // a word beside the circle, for an action that's easy to miss or costly to
  // mistake for another (a wizard's Next and Finish)
  text?: string;
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
// a page's own menu (see useTopBarMenu): what's in it as state, and its
// items' current handlers in a ref, as for the action above
const MenuShownContext = createContext<{ items: TopBarMenuItem[] | null; setItems: (items: TopBarMenuItem[] | null) => void } | null>(null);
const MenuHandlersContext = createContext<RefObject<TopBarMenuItem[]> | null>(null);

export function TopBarActionProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const handler = useRef<(() => void) | null>(null);
  const [items, setItems] = useState<TopBarMenuItem[] | null>(null);
  const menuHandlers = useRef<TopBarMenuItem[]>([]);
  return (
    <ShownContext.Provider value={{ shown, setShown }}>
      <HandlerContext.Provider value={handler}>
        <MenuShownContext.Provider value={{ items, setItems }}>
          <MenuHandlersContext.Provider value={menuHandlers}>{children}</MenuHandlersContext.Provider>
        </MenuShownContext.Provider>
      </HandlerContext.Provider>
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
  const text = action?.text;
  useEffect(() => {
    if (!setShown || !label || !icon) return;
    setShown({ label, icon, disabled, variant, text });
    return () => setShown(null);
  }, [setShown, label, icon, disabled, variant, text]);
}

/* A page's own menu for TopBar's right-hand slot, where what it offers runs
   the page's code (an event's Share) as well as linking somewhere, and
   depends on the page's state (Stop sharing once there's a link). Built like
   useTopBarAction: the items shown are state, changing only when what's in
   the menu does; each item's handler is read from a ref when it's chosen, so
   it always sees the page as it is. It takes the slot over pageAction and
   pageMenu; null (or an empty list) shows nothing. */
export function useTopBarMenu(items: TopBarMenuItem[] | null) {
  const handlersRef = useContext(MenuHandlersContext);
  const setItems = useContext(MenuShownContext)?.setItems;

  useEffect(() => {
    if (handlersRef) handlersRef.current = items ?? [];
  });

  // what the menu shows, as a key that only changes when that does
  const key = items && items.length > 0 ? items.map((i) => [i.label, i.href ?? "", i.file ? 1 : 0, i.disabled ? 1 : 0, i.danger ? 1 : 0, i.iconClassName ?? ""].join("|")).join("\n") : "";
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(() => {
    if (!setItems || !key) return;
    // an item that runs code calls whatever handler it has now, by its label
    setItems(
      (itemsRef.current ?? []).map((i) =>
        i.onSelect ? { ...i, onSelect: () => handlersRef?.current.find((h) => h.label === i.label)?.onSelect?.() } : i,
      ),
    );
    return () => setItems(null);
  }, [setItems, key, handlersRef]);
}

// for TopBar: the current page's own menu, if it registered one
export function useCurrentTopBarMenu(): TopBarMenuItem[] | null {
  return useContext(MenuShownContext)?.items ?? null;
}

// for TopBar: the current page's action, if it registered one, and a way to run it
export function useCurrentTopBarAction(): { shown: Shown | null; run: () => void } {
  const shown = useContext(ShownContext)?.shown ?? null;
  const handlerRef = useContext(HandlerContext);
  return { shown, run: () => handlerRef?.current?.() };
}
