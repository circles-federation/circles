import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useToast } from "@/components/shared/toast";
import { useAppState } from "@/components/providers/app-state-provider";
import { indexCircles, type CirclesById } from "./circles.util";
import { hasEnded } from "./events.util";
import { isPastEvent } from "./format.util";
import { awaitingResponse } from "./proposals.util";
import { currentSubscription, pushPermission, pushSupported, subscribeThisDevice, unsubscribeThisDevice } from "./push-client";
import type { Circle, CircleInvitation, CircleProposal, CircleResource, CircleTask, Event, Member, ProposalChanges, TaskStatus } from "./types";

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

/* What's waiting on the member, for Home's Needs you and the dot on its nav
   tab, so the two can't disagree: an admin's reviews (applications and new
   photos; 0 for everyone else), the proposals waiting on their answer and
   the invitations sent to them (`count` is these three), and, waiting on
   others, their own open proposals. Proposals soonest to close first. */
export function useNeedsYou() {
  const { pendingReviews, invitations, proposals, profile } = useAppState();
  const byClosing = (a: CircleProposal, b: CircleProposal) => a.closesAt.localeCompare(b.closesAt);
  const reviews = pendingReviews ?? 0;
  const awaitingMe = proposals.filter((p) => awaitingResponse(p, profile.id)).sort(byClosing);
  const myInvitations = invitations.filter((i) => i.memberId === profile.id);
  const mineOpen = proposals.filter((p) => p.status === "open" && p.proposerId === profile.id).sort(byClosing);
  return { reviews, awaitingMe, myInvitations, mineOpen, count: reviews + awaitingMe.length + myInvitations.length };
}

// whether Home has something waiting on the member, for the dot on its nav
// tab; stands in for a notifications screen until there is one
export function useHomeNeedsAttention(): boolean {
  return useNeedsYou().count > 0;
}

/* Ticking a task done from a list, and ticking it again (a slip of the
   thumb, say) to put it back as it was (In progress stays In progress)
   rather than always to To do. `tickedHere` says which tasks were ticked
   done from this list, for a list that leaves done tasks out but keeps one
   ticked here (Home's My tasks), so it can be put back, and stays put
   whatever the server says. */
export function useTaskTick() {
  const { setTaskStatus } = useAppState();
  const [before, setBefore] = useState<Record<string, TaskStatus>>({});
  function toggle(t: CircleTask) {
    if (t.status === "done") {
      void setTaskStatus(t.id, before[t.id] ?? "todo");
    } else {
      setBefore((was) => ({ ...was, [t.id]: t.status }));
      void setTaskStatus(t.id, "done");
    }
  }
  return { toggle, tickedHere: (id: string) => id in before };
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
    // a bulletin item's form as a page — what a phone gets instead of the dialog
    addResource: (c: Circle) => router.push(`/circles/${c.id}/bulletin/new`),
    editResource: (r: CircleResource) => router.push(`/circles/${r.circleId}/bulletin/${r.id}`),
    // inviting people to a circle, as a page — what a phone gets instead of the dialog
    inviteTo: (c: Circle) => router.push(`/circles/${c.id}/invite`),
    openInvitation: (i: CircleInvitation) => router.push(`/invitations/${i.id}`),
    // a member's profile page, from anywhere a member is shown
    openMember: (m: Member) => router.push(`/profile/${m.id}`),
    // hostCircle, when given, starts the form as that circle's proposal
    newEvent: (hostCircle?: Circle) => router.push(hostCircle ? `/events/new?host=${hostCircle.id}` : "/events/new"),
    // an event shown to this circle and hosted by the person — for a group, which can't host
    newEventIn: (circle: Circle) => router.push(`/events/new?circle=${circle.id}`),
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

/* Whether push notifications are on for this device, and the way to turn
   them on or off (lib/push-client.ts). "unknown" until it's been read, which
   is also what the server renders; "unsupported" where the browser has no
   push at all, such as an iPhone browser tab rather than the installed app;
   "denied" once the person has blocked notifications for Circles, which only
   their device's settings can undo. subscribe() must be called from a tap. */
export type PushStatus = "unknown" | "unsupported" | "denied" | "off" | "on";

async function readPushStatus(subscribed: boolean): Promise<PushStatus> {
  if (subscribed) return "on";
  return (await pushPermission()) === "denied" ? "denied" : "off";
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("unknown");
  useEffect(() => {
    let live = true;
    (async () => (pushSupported() ? await readPushStatus(!!(await currentSubscription())) : "unsupported"))()
      .then((s) => live && setStatus(s))
      .catch((err) => console.error("Couldn't read this device's notification setting:", err));
    return () => {
      live = false;
    };
  }, []);
  async function subscribe(): Promise<boolean> {
    const on = await subscribeThisDevice();
    setStatus(await readPushStatus(on));
    return on;
  }
  async function unsubscribe(): Promise<void> {
    await unsubscribeThisDevice();
    setStatus(await readPushStatus(false));
  }
  return { status, subscribe, unsubscribe };
}

/* The time now, to the last `CLOCK_STEP_MS`, re-rendering as it moves on —
   for things that appear or count down by the clock (Home's starting-soon
   card). null on the server and while hydrating, where there's no "now" the
   two could agree on. Rounded down to the step, so every read within one
   step returns the same value, as useSyncExternalStore needs. */
const CLOCK_STEP_MS = 15_000;
const clockNow = () => Math.floor(Date.now() / CLOCK_STEP_MS) * CLOCK_STEP_MS;
function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, CLOCK_STEP_MS);
  return () => clearInterval(timer);
}
export function useClock(): number | null {
  return useSyncExternalStore(subscribeClock, clockNow, () => null);
}

/* Whether an event is over, for turning off what can no longer be done on
   its page (RSVP, vote, take a slot): from its end time, re-checked as the
   clock ticks, rather than only from the next day as isPastEvent is. On the
   server, and while hydrating, only the day counts, so the markup matches. */
export function useEventEnded(e: Pick<Event, "date" | "start" | "end">): boolean {
  const now = useClock();
  return isPastEvent(e) || (now !== null && hasEnded(e, new Date(now)));
}

// set once the app has hydrated: before then, what the server rendered has to
// be matched, so saved history state isn't read
let hydrated = false;

/* useState whose value is also kept on the current browser history entry, so
   Back (or Forward) to the page brings it back as it was left, and the page
   is as long as it was, so its scroll position can be put back too, while
   opening the page afresh starts from `initial`. Next keeps its own keys when
   the entry's state is replaced. A reload starts from `initial`. */
export function useHistoryState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (!hydrated || typeof window === "undefined") return initial;
    const saved = (window.history.state as Record<string, unknown> | null)?.[key];
    return saved === undefined ? initial : (saved as T);
  });
  useEffect(() => {
    hydrated = true;
  }, []);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      window.history.replaceState({ ...(window.history.state as object | null), [key]: next }, "");
    },
    [key]
  );
  return [value, set];
}

/* For the Manage circle pages (app/(app)/circles/[id]/manage/): the circle in
   the URL, which only its members can manage (the server enforces this too —
   see updateCircle in lib/db/circles.ts), so to anyone else, or for a circle
   that doesn't exist, the page 404s; and the change to it that's open for
   consent, if one is, which holds its Details and Roles until it's decided
   (its events' proposals don't). `allowGone` skips the 404 for a page that's
   about to leave anyway (the member is leaving the circle). */
export function useManagedCircle({ allowGone = false } = {}): { circle: Circle; openProposal?: CircleProposal } | null {
  const { id } = useParams<{ id: string }>();
  const { circles, proposals, profile } = useAppState();
  const circle = circles.find((c) => c.id === id);
  if (!circle || !circle.members.includes(profile.id)) {
    if (allowGone) return null;
    notFound();
  }
  // a change to it, whether its own members decide it or its neighborhood does too
  const openProposal = proposals.find((p) => p.kind === "change" && p.status === "open" && (p.subjectCircleId ?? p.circleId) === circle.id);
  return { circle, ...(openProposal ? { openProposal } : {}) };
}

/* Proposing changes to a circle from a Manage circle page: a circle of one
   decides it at once, so it's back to the menu; otherwise on to the
   proposal's page, where the proposer can watch the answers come in. */
export function useProposeCircleChanges(circle: Circle) {
  const { proposeCircleChanges, circles } = useAppState();
  const { showToast } = useToast();
  const router = useRouter();
  const goBack = useGoBack();
  return async (changes: ProposalChanges): Promise<{ ok: true } | { ok: false; error: string }> => {
    const result = await proposeCircleChanges(circle.id, changes);
    if (!result.ok) return result;
    if (result.passed) {
      showToast({ tone: "success", title: "Changes saved", message: "You're its only member, so they were made at once." });
      goBack();
    } else {
      // a change its neighborhood decides too asks the residents in their digest
      const neighborhood = result.proposal.subjectCircleId ? circles.find((c) => c.id === result.proposal.circleId) : undefined;
      showToast({
        tone: "success",
        title: "Proposal sent",
        message: neighborhood ? `${circle.name}'s members, and everyone in ${neighborhood.name}, have been asked to consent.` : `${circle.name}'s members have been asked to consent.`,
      });
      router.replace(`/proposals/${result.proposal.id}`);
    }
    return { ok: true };
  };
}
