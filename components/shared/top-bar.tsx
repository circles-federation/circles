"use client";

import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, Cog6ToothIcon, HomeIcon, PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack, useRunBackHandler } from "@/components/providers/back-handler-provider";
import { useCurrentTopBarAction } from "@/components/providers/top-bar-action-provider";
import { isCircleMember } from "@/lib/circles.util";
import { isPastEvent } from "@/lib/format.util";
import { isEventOrganizer } from "@/lib/governance.util";
import { useHomeNeedsAttention } from "@/lib/hooks";
import type { Circle, CircleResource, Event, Member, Profile } from "@/lib/types";
import { activeTab } from "@/lib/nav.util";
import { resourceFormTitle } from "@/components/circles/resource-kinds";
import { AttentionDot } from "./attention-dot";
import { GhostIconButton } from "./ghost-icon-button";
import { OfflineBanner } from "./offline-banner";

const TABS: [string, string][] = [
  ["/home", "Home"],
  ["/circles", "Circles"],
  ["/events", "Events"],
];

const NAV_LINK = "border-b-2 py-1 font-sans text-xs font-semibold tracking-wide text-ink uppercase no-underline";

// the right-hand slot for an icon button: its 44px tap area, with the 40px
// circle inside so the bar is no taller; -mr-0.5 lines the circle's edge up
// with the page's padding. The same on every screen size.
const ICON_BUTTON_SLOT = "group -mr-0.5 flex size-11 shrink-0 items-center justify-center";

// primary is the page's main job, in blue (Manage circle's Save); secondary
// is the rest, in ink (Create Event, Manage circle, Edit event). A press
// shrinks it a touch, and darkens the blue (ink has no darker to go).
const ICON_BUTTON_FILL = {
  primary: "bg-action text-paper group-active:brightness-90",
  secondary: "bg-ink text-paper",
};

/* The circle of an icon button, for ICON_BUTTON_SLOT's button or link to put
   round it. Disabled (a button that has nothing to do yet), it's only a faint
   outline round a grey icon. */
function IconButtonCircle({ icon: Icon, variant }: { icon: ComponentType<SVGProps<SVGSVGElement>>; variant: keyof typeof ICON_BUTTON_FILL }) {
  return (
    <span
      className={clsx(
        "flex size-10 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(10,10,10,0.25)] transition-[filter,transform,background-color] duration-100 group-active:scale-95",
        ICON_BUTTON_FILL[variant],
        "group-disabled:border group-disabled:border-faint group-disabled:bg-transparent group-disabled:text-soft group-disabled:shadow-none group-disabled:group-active:scale-100 group-disabled:group-active:brightness-100",
      )}
    >
      <Icon className="size-5" strokeWidth={2.5} />
    </span>
  );
}

interface PageAction {
  href: string;
  label: string;
  icon: typeof PlusIcon;
}

// a page's own primary action, shown in the bar while that page is: an icon
// button on the right, on every screen size
function pageAction(pathname: string, circles: Circle[], events: Event[], profile: Profile): PageAction | null {
  if (pathname === "/events") return { href: "/events/new", label: "Create Event", icon: PlusIcon };
  if (pathname === "/home") return { href: "/settings", label: "Settings", icon: Cog6ToothIcon };
  // creating a circle starts it wherever Create was pressed: the city here,
  // or the neighborhood whose page it's pressed on (below)
  if (pathname === "/circles") return { href: "/circles/new", label: "Create circle", icon: PlusIcon };
  const [section, id, sub] = pathname.split("/").slice(1);
  if (section === "events" && id && id !== "new" && !sub) {
    // an event's own page, which only its organizer can edit, until it's
    // cancelled or over
    const event = events.find((e) => e.id === id);
    if (event && isEventOrganizer(event, profile) && !event.cancelled && !isPastEvent(event)) {
      return { href: `/events/${id}/edit`, label: "Edit event", icon: PencilIcon };
    }
  }
  // your own profile page is where you edit it
  if (section === "profile" && id === String(profile.id)) return { href: "/profile/edit", label: "Edit profile", icon: PencilIcon };
  if (section === "circles" && id && !sub) {
    // a circle's own page, which only its members can manage (a
    // neighborhood's folder view has nothing to manage)
    const circle = circles.find((c) => c.id === id);
    if (circle?.type === "neighborhood") return { href: `/circles/new?parent=${id}`, label: "Create circle", icon: PlusIcon };
    if (circle && isCircleMember(circle, profile.id)) {
      return { href: `/circles/${id}/manage`, label: "Manage circle", icon: Cog6ToothIcon };
    }
  }
  return null;
}

// the title for every route under app/(app)/. A circle or event page is titled
// by its name; a lookup that misses (the page is about to 404) falls back to
// its section, so the bar never shows an id
function pageTitle(pathname: string, circles: Circle[], events: Event[], members: Member[], resources: CircleResource[]): string {
  const [section, id, sub, item] = pathname.split("/").slice(1);
  if (section === "circles") {
    if (!id) return "Circles";
    if (id === "new") return "New circle";
    if (sub === "manage") return "Manage circle";
    if (sub === "bulletin") return resourceFormTitle(resources.find((r) => r.id === item)?.icon);
    if (sub === "invite") return "Invite";
    return circles.find((c) => c.id === id)?.name ?? "Circles";
  }
  if (section === "events") {
    if (!id) return "Events";
    if (id === "new") return "New event";
    if (sub === "edit") return "Edit event";
    return events.find((e) => e.id === id)?.title ?? "Events";
  }
  if (section === "profile") {
    if (id === "edit") return "Edit profile";
    return members.find((m) => String(m.id) === id)?.name ?? "Profile";
  }
  if (section === "game") return "Name game";
  if (section === "settings") return id === "notifications" ? "Notifications" : "Settings";
  if (section === "admin") return sub ? "Application" : "Applications";
  if (section === "invitations") return "Invitation";
  return "Home";
}

export function TopBar({ onReselect }: { onReselect: () => void }) {
  const pathname = usePathname();
  const { circles, events, members, resources, profile } = useAppState();
  const needsAttention = useHomeNeedsAttention();
  const isHomeNeighborhood =profile.homeCircleId !== null && pathname === `/circles/${profile.homeCircleId}`;

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

  // the tab this page belongs to, if any (the same rule as BottomNav's)
  const currentTab = activeTab(pathname);

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
      {/* the title on the left, the page's action on the right, and on desktop the
          tabs centred on the bar itself (not between the two), so a long title
          can't push them off-centre: it stops short of them instead */}
      <div className="relative mx-auto flex h-14.5 max-w-270 items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-1 min-[720px]:max-w-[calc(50%-9rem)]">
          {!isTabRoot && <GhostIconButton icon={ArrowLeftIcon} label="Back" onClick={goBack} className="-ml-2.5" />}
          <span className="truncate font-sans text-lg font-extrabold tracking-[-0.02em]">
            {pageTitle(pathname, circles, events, members, resources)}
          </span>
          {isHomeNeighborhood && <HomeIcon className="ml-1 size-5 shrink-0 text-teal" strokeWidth={2} aria-label="Your neighborhood" />}
        </div>

        {/* a page's own action (see useTopBarAction) takes the slot over a
            link-style one */}
        {pageOwn?.variant === "primary" ? (
          <button
            type="button"
            onClick={runPageOwn}
            disabled={pageOwn.disabled}
            aria-label={pageOwn.label}
            className={clsx(ICON_BUTTON_SLOT, "cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default")}
          >
            <IconButtonCircle icon={pageOwn.icon} variant="primary" />
          </button>
        ) : pageOwn ? (
          <button
            type="button"
            onClick={runPageOwn}
            disabled={pageOwn.disabled}
            aria-label={pageOwn.label}
            className="-mr-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink disabled:cursor-default disabled:text-faint"
          >
            <pageOwn.icon className="size-6" strokeWidth={2} />
          </button>
        ) : action && (
          <Link href={action.href} aria-label={action.label} className={ICON_BUTTON_SLOT}>
            <IconButtonCircle icon={action.icon} variant="secondary" />
          </Link>
        )}

        {/* on mobile, these three destinations live in BottomNav instead —
            hidden via CSS breakpoint (not a JS width check) so this never has to
            reconcile a server/client mismatch on the first paint. */}
        <nav className="absolute top-1/2 left-1/2 hidden -translate-1/2 items-center gap-6 min-[720px]:flex">
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
              className={clsx(NAV_LINK, "relative", currentTab === href ? "border-b-ink" : "border-b-transparent")}
            >
              {label}
              {href === "/home" && needsAttention && <AttentionDot className="top-0 -right-3" />}
            </Link>
          ))}
        </nav>
      </div>
      <OfflineBanner />
    </div>
  );
}
