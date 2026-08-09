import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* Tracks whether the viewport is below a mobile breakpoint. Always starts
   `false` (matching what the server renders, since it has no viewport to
   read) and corrects itself in an effect after mount — reading
   window.innerWidth during the initial render instead would make the
   client's first paint disagree with the server's on any actually-mobile
   viewport, which React reports as a hydration mismatch. */
export function useIsMobile(breakpoint = 720) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < breakpoint); }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

// old view-state names -> routes, for components still written against the
// pre-routing "setView(key)" API (only ever called with "orgs" or "events")
const VIEW_ROUTES = {
  home: "/home",
  federation: "/federation",
  directory: "/people",
  orgs: "/organizations",
  events: "/events",
  editMyself: "/profile/edit",
  game: "/game",
};

/* Centralizes the handful of "go somewhere" callbacks that used to be
   closures over setView/setActiveEvent/etc. in the single root component.
   Every route that needs to navigate pulls this instead of constructing
   router.push() paths inline, so the URL shape only has to be right here. */
export function useAppNav() {
  const router = useRouter();
  return {
    setView: (key) => router.push(VIEW_ROUTES[key] || `/${key}`),
    // backLabel, when given, becomes the detail page's back-button text (via
    // its ?from= query param) — so "back" reads correctly for wherever this
    // link was actually clicked from, instead of a hardcoded destination
    // that's only right when linked from the plain list view.
    openEvent: (e, backLabel) => router.push(`/events/${e.id}${backLabel ? `?from=${encodeURIComponent(backLabel)}` : ""}`),
    openOrg: (o, backLabel) => router.push(`/organizations/${o.id}${backLabel ? `?from=${encodeURIComponent(backLabel)}` : ""}`),
    openNeighbors: (hood) => router.push(`/people?hood=${encodeURIComponent(hood)}`),
    openLocalOrgs: (level) => router.push(`/organizations?level=${encodeURIComponent(level)}`),
  };
}
