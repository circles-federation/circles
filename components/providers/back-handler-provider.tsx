"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";

type BackHandler = () => void;

/* TopBar's Back button is app chrome, mounted once above every route, so it
   can't know that a form has unsaved changes. A page that needs to intercept
   leaving (to ask before discarding edits) registers its own handler here
   with useBackHandler; TopBar calls it instead of navigating. Held in a ref,
   not state: only the button's click reads it, so registering a new closure
   on every render of the form shouldn't re-render the top bar.

   This also knows whether there's anywhere in the app to go back to (see
   useGoBack), since it's mounted once for every signed-in page. */
const BackHandlerContext = createContext<RefObject<BackHandler | null> | null>(null);
const NavigationsContext = createContext<RefObject<number> | null>(null);

export function BackHandlerProvider({ children }: { children: ReactNode }) {
  const handler = useRef<BackHandler | null>(null);

  // how many times the page has changed since the app loaded: none means
  // this page was opened directly, so there's no in-app page to go back to.
  // Counted from pathname changes, not effect runs, so Strict Mode's second
  // run doesn't count as one.
  const pathname = usePathname();
  const navigationsRef = useRef(0);
  const lastPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastPathRef.current !== null && lastPathRef.current !== pathname) navigationsRef.current += 1;
    lastPathRef.current = pathname;
  }, [pathname]);

  return (
    <BackHandlerContext.Provider value={handler}>
      <NavigationsContext.Provider value={navigationsRef}>{children}</NavigationsContext.Provider>
    </BackHandlerContext.Provider>
  );
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

// where going back leads when there's no in-app page to go back to: one URL
// segment up, except for pages that only Home links to, whose own parent
// segment isn't a route
function parentRoute(pathname: string): string {
  // Edit profile is reached from Settings (or your own profile page)
  if (pathname === "/profile/edit") return "/settings";
  const parent = pathname.replace(/\/[^/]+\/?$/, "");
  if (parent === "" || parent === "/profile" || parent === "/admin" || parent === "/invitations") return "/home";
  // a bulletin item's form is reached from its circle's Bulletin tab
  const bulletin = parent.match(/^(\/circles\/[^/]+)\/bulletin$/);
  if (bulletin) return `${bulletin[1]}?tab=bulletin`;
  return parent;
}

/* Back, like a native app's: to the previous page when there is one in the
   app, and otherwise up to the page's parent, so it never leaves the app for
   whatever site linked here (or a blank tab, after a reload). TopBar's Back
   button, and a page that goes back once it's done (Manage circle, after
   saving), both use this rather than router.back(). */
export function useGoBack(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const navigationsRef = useContext(NavigationsContext);
  return () => {
    if (navigationsRef && navigationsRef.current > 0) router.back();
    else router.push(parentRoute(pathname));
  };
}
