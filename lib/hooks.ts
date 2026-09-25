import { useMemo, useSyncExternalStore } from "react";
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

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/* Whether the device has a network connection, as the browser reports it:
   reliable for "none at all" (airplane mode, no signal), blind to a
   connection that's up but not reaching anything. Online on the server and
   the first paint, so an offline device just shows it a moment later. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeToConnection, () => navigator.onLine, () => true);
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
    openEvent: (e: Event) => router.push(`/events/${e.id}`),
    // every circle lives at /circles/[id], keyed by its own stable id rather
    // than its position in the tree — a neighborhood renders as the folder
    // view there, everything else as its own detail page (see
    // app/(app)/circles/[id]/page.tsx), so reparenting a circle never changes
    // its URL. entityTypes, when given, seeds the folder view's own Type
    // filter via a ?types= query param (comma-joined) — e.g. Home's
    // "Neighbors"/"Local circles" stat cards land pre-filtered instead of
    // dumping the visitor on the unfiltered folder and making them filter by
    // hand. The city root's own view is the Circles browser's top level, not
    // a /circles/[id] page of its own.
    openCircle: (c: Circle, entityTypes?: string[]) => {
      const qs = entityTypes && entityTypes.length > 0 ? `?types=${entityTypes.join(",")}` : "";
      router.push(c.parentId === null ? "/circles" : `/circles/${c.id}${qs}`);
    },
  };
}
