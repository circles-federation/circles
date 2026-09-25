"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, Cog6ToothIcon, HomeIcon, PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack, useRunBackHandler } from "@/components/providers/back-handler-provider";
import { useCurrentTopBarAction } from "@/components/providers/top-bar-action-provider";
import { isCircleMember } from "@/lib/circles.util";
import { isEventOrganizer } from "@/lib/governance.util";
import type { Circle, Event, Profile } from "@/lib/types";
import { OfflineBanner } from "./offline-banner";

const TABS: [string, string][] = [
  ["/home", "Home"],
  ["/circles", "Circles"],
  ["/events", "Events"],
];

const NAV_LINK = "border-b-2 py-1 font-sans text-xs font-semibold tracking-wide text-ink uppercase no-underline";

interface PageAction {
  href: string;
  label: string;
  icon: typeof PlusIcon;
  // also shown on desktop, as a text link before the tabs — otherwise the
  // page has its own control there (a circle's masthead Manage button, an
  // event's Edit Event)
  desktop: boolean;
}

// a page's own primary action, shown in the bar while that page is: an icon
// on the right on mobile
function pageAction(pathname: string, circles: Circle[], events: Event[], profile: Profile): PageAction | null {
  if (pathname === "/events") return { href: "/events/new", label: "Create Event", icon: PlusIcon, desktop: true };
  const [section, id, sub] = pathname.split("/").slice(1);
  if (section === "events" && id && id !== "new" && !sub) {
    // an event's own page, which only its organizer can edit
    const event = events.find((e) => e.id === id);
    if (event && isEventOrganizer(event, profile)) {
      return { href: `/events/${id}/edit`, label: "Edit event", icon: PencilIcon, desktop: false };
    }
  }
  if (section === "circles" && id && !sub) {
    // a circle's own page, which only its members can manage (a
    // neighborhood's folder view has nothing to manage)
    const circle = circles.find((c) => c.id === id);
    if (circle && circle.type !== "neighborhood" && isCircleMember(circle, profile.id)) {
      return { href: `/circles/${id}/manage`, label: "Manage circle", icon: Cog6ToothIcon, desktop: false };
    }
  }
  return null;
}

// the title for every route under app/(app)/. A circle or event page is titled
// by its name; a lookup that misses (the page is about to 404) falls back to
// its section, so the bar never shows an id
function pageTitle(pathname: string, circles: Circle[], events: Event[]): string {
  const [section, id, sub] = pathname.split("/").slice(1);
  if (section === "circles") {
    if (!id) return "Circles";
    if (sub === "manage") return "Manage circle";
    return circles.find((c) => c.id === id)?.name ?? "Circles";
  }
  if (section === "events") {
    if (!id) return "Events";
    if (id === "new") return "New event";
    if (sub === "edit") return "Edit event";
    return events.find((e) => e.id === id)?.title ?? "Events";
  }
  if (section === "profile") return "Edit profile";
  if (section === "game") return "Name game";
  return "Home";
}

export function TopBar({ onReselect }: { onReselect: () => void }) {
  const pathname = usePathname();
  const { circles, events, profile } = useAppState();
  const isHomeNeighborhood = profile.homeCircleId !== null && pathname === `/circles/${profile.homeCircleId}`;

  // Like Flutter's automatic leading back button: shown on every route except
  // the tab roots. A page with unsaved changes can intercept it; otherwise it
  // goes back without ever leaving the app (see useGoBack).
  const isTabRoot = TABS.some(([href]) => pathname === href);
  const action = pageAction(pathname, circles, events, profile);
  const { shown: pageOwn, run: runPageOwn } = useCurrentTopBarAction();
  const runBackHandler = useRunBackHandler();
  const goBackInApp = useGoBack();

  function goBack() {
    if (runBackHandler()) return;
    goBackInApp();
  }

  // a tab is "active" if the current route is it or a nested route beneath
  // it, or (for Home) one of the sibling pages reached only from Home. Every
  // circle page (neighborhood folder view, circle detail, or manage) lives
  // under /circles regardless of how deep the circle sits in the hierarchy
  // — see lib/hooks.ts's openCircle — so the generic case below covers it.
  function isActive(href: string): boolean {
    if (href === "/home") return pathname === "/home" || pathname === "/game" || pathname.startsWith("/profile");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // Installed as an app, the bar lies over AppShell's scrolling <main> instead
  // of above it, so the page scrolls up under its see-through lower edge as in
  // a native app; <main> is padded down by the bar's height, published here
  // as --top-bar-height since it changes (the offline banner, a landscape
  // notch). In a browser tab it's sticky over the scrolling page to the same
  // effect, and the variable goes unused.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--top-bar-height", `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--top-bar-height");
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="app-chrome sticky top-0 z-50 bg-linear-to-t from-paper/85 to-paper pt-[env(safe-area-inset-top)] backdrop-blur-md shadow-[0_2px_6px_rgba(10,10,10,0.08)] standalone:absolute standalone:inset-x-0"
    >
      <div className="mx-auto flex h-14.5 max-w-270 items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-1">
          {!isTabRoot && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="-ml-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink"
            >
              <ArrowLeftIcon className="size-6" strokeWidth={2} />
            </button>
          )}
          <span className="truncate font-sans text-lg font-extrabold tracking-[-0.02em]">
            {pageTitle(pathname, circles, events)}
          </span>
          {isHomeNeighborhood && <HomeIcon className="ml-1 size-5 shrink-0 text-teal" strokeWidth={2} aria-label="Your neighborhood" />}
        </div>

        {/* a page's own action (see useTopBarAction) takes the slot over a
            link-style one */}
        {pageOwn ? (
          <button
            type="button"
            onClick={runPageOwn}
            disabled={pageOwn.disabled}
            aria-label={pageOwn.label}
            className="-mr-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink disabled:cursor-default disabled:text-faint min-[720px]:hidden"
          >
            <pageOwn.icon className="size-6" strokeWidth={2} />
          </button>
        ) : action && (
          <Link
            href={action.href}
            aria-label={action.label}
            className="-mr-2.5 flex size-11 shrink-0 items-center justify-center text-ink min-[720px]:hidden"
          >
            <action.icon className="size-6" strokeWidth={2} />
          </Link>
        )}

        {/* on mobile, these three destinations live in BottomNav instead —
            hidden via CSS breakpoint (not useIsMobile) so this never has to
            reconcile a server/client mismatch on the first paint. */}
        <nav className="hidden shrink-0 items-center gap-6 pl-6 min-[720px]:flex">
          {action?.desktop && (
            <>
              <Link href={action.href} className={clsx(NAV_LINK, "border-b-transparent")}>
                {action.label}
              </Link>
              <div className="h-4 w-px bg-faint" />
            </>
          )}
          {TABS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              // like BottomNav: the tab already showing goes back to its top
              onClick={(e) => {
                if (pathname !== href) return;
                e.preventDefault();
                onReselect();
              }}
              className={clsx(NAV_LINK, isActive(href) ? "border-b-ink" : "border-b-transparent")}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <OfflineBanner />
    </div>
  );
}
