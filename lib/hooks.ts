import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/providers/app-state-provider";
import { indexCircles, type CirclesById } from "./circles.util";
import type { Circle, Event, Member } from "./types";

/* The seam components reach live data through — a hook here rather than
   importing lib/data.ts's seed constants or threading props, so where the
   data actually comes from (today AppStateProvider's server-seeded state) can
   change without touching call sites. */
export function useMembers(): Member[] {
  return useAppState().members;
}

/* A member-by-id lookup bound to useMembers() above — the hook call itself
   happens once, here, at the top of the calling component; the plain
   function it returns is what's actually safe to hand to .map() or call
   per-item afterward (a hook can't be called once per array item — that's
   a Rules-of-Hooks violation — but a plain closure returned by one can). */
export function useMemberById(): (id: number) => Member | undefined {
  const members = useMembers();
  return (id: number) => members.find((m) => m.id === id);
}

export function useCircles(): Circle[] {
  return useAppState().circles;
}

// id -> circle lookup, the shape circles.util.ts's tree helpers and
// governance.util.ts's rules take
export function useCirclesById(): CirclesById {
  const circles = useCircles();
  return useMemo(() => indexCircles(circles), [circles]);
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
// pre-routing "setView(key)" API (only ever called with "circles" or "events")
const VIEW_ROUTES: Record<string, string> = {
  home: "/home",
  circles: "/circles",
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
    // every circle lives at /circles/[id], keyed by its own stable id rather
    // than its position in the tree — a neighborhood renders as the folder
    // view there, everything else as its own detail page (see
    // app/(app)/circles/[id]/page.tsx), so reparenting a circle never changes
    // its URL. entityTypes, when given, seeds the folder view's own Type
    // filter via a ?types= query param (comma-joined) — e.g. Home's
    // "Neighbors"/"Local circles" stat cards land pre-filtered instead of
    // dumping the visitor on the unfiltered folder and making them filter by
    // hand.
    openCircle: (c: Circle, backLabel?: string, entityTypes?: string[]) => {
      const params = new URLSearchParams();
      if (backLabel) params.set("from", backLabel);
      if (entityTypes && entityTypes.length > 0) params.set("types", entityTypes.join(","));
      const qs = params.toString();
      router.push(`/circles/${c.id}${qs ? `?${qs}` : ""}`);
    },
  };
}
