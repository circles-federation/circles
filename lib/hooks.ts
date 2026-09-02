import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "./data";
import type { Event, Member, Org } from "./types";

/* Seam for the roster of members — a thin wrapper around the static seed
   array for now, but the intended shape going forward for any data a
   component needs: reach for a hook here rather than importing lib/data.ts's
   constants directly, so a future real fetch (e.g. lib/db/members.ts's
   getMembers(), or AppStateProvider tracking members once it needs to) can
   replace this function's insides without touching call sites. */
export function useMembers(): Member[] {
  return MEMBERS;
}

/* Tracks whether the viewport is below a mobile breakpoint. Always starts
   `false` (matching what the server renders, since it has no viewport to
   read) and corrects itself in an effect after mount — reading
   window.innerWidth during the initial render instead would make the
   client's first paint disagree with the server's on any actually-mobile
   viewport, which React reports as a hydration mismatch. */
export function useIsMobile(breakpoint = 720): boolean {
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
const VIEW_ROUTES: Record<string, string> = {
  home: "/home",
  federation: "/federation",
  directory: "/directory",
  orgs: "/directory",
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
    setView: (key: string) => router.push(VIEW_ROUTES[key] || `/${key}`),
    // backLabel, when given, becomes the detail page's back-button text (via
    // its ?from= query param) — so "back" reads correctly for wherever this
    // link was actually clicked from, instead of a hardcoded destination
    // that's only right when linked from the plain list view.
    openEvent: (e: Event, backLabel?: string) => router.push(`/events/${e.id}${backLabel ? `?from=${encodeURIComponent(backLabel)}` : ""}`),
    // every org lives at /directory/[id], keyed by its own stable id rather
    // than its position in the tree — a Neighborhood Council (org.neighborhood
    // set) renders as the folder view there, everything else as its own
    // detail page (see app/(app)/directory/[id]/page.jsx), so reparenting an
    // org never changes its URL. entityTypes, when given, seeds the folder
    // view's own Type filter via a ?types= query param (comma-joined) — e.g.
    // Home's "Neighbors"/"Local circles" stat cards land pre-filtered instead
    // of dumping the visitor on the unfiltered folder and making them filter
    // by hand.
    openOrg: (o: Org, backLabel?: string, entityTypes?: string[]) => {
      const params = new URLSearchParams();
      if (backLabel) params.set("from", backLabel);
      if (entityTypes && entityTypes.length > 0) params.set("types", entityTypes.join(","));
      const qs = params.toString();
      router.push(`/directory/${o.id}${qs ? `?${qs}` : ""}`);
    },
  };
}
