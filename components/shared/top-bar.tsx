"use client";

import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon, BookOpenIcon, CalendarIcon, CheckCircleIcon, EllipsisHorizontalIcon, HandRaisedIcon, HomeIcon, InboxIcon, MegaphoneIcon, PencilIcon, PlusIcon, UserGroupIcon, UserPlusIcon, UsersIcon } from "@heroicons/react/24/outline";
import { PlayIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack, useRunBackHandler } from "@/components/providers/back-handler-provider";
import { useCurrentTopBarAction, useCurrentTopBarMenu } from "@/components/providers/top-bar-action-provider";
import { openProposalsFor } from "@/lib/proposals.util";
import { CIRCLE_SECTION_LABEL, circleHasPage, circleSections, defaultCircleSection, isCircleMember, isCircleSection, postingCirclesFor, type CircleSection } from "@/lib/circles.util";
import { useHomeNeedsAttention } from "@/lib/hooks";
import type { Circle, CircleResource, Event, Member, Profile } from "@/lib/types";
import { activeTab } from "@/lib/nav.util";
import { resourceFormTitle } from "@/components/circles/resource-kinds";
import { AttentionDot } from "./attention-dot";
import { GhostIconButton } from "./ghost-icon-button";
import { ICON_BUTTON_SLOT, IconButtonCircle } from "./icon-button-circle";
import { OfflineBanner } from "./offline-banner";
import { ProfileMenu } from "./profile-menu";
import { SimpleTabs } from "./simple-tabs";
import { RingIcon } from "./ring-icon";
import { MenuIconFace, TopBarMenu, type TopBarMenuItem } from "./top-bar-menu";

const TABS: [string, string][] = [
  ["/home", "Home"],
  ["/circles", "Circles"],
  ["/events", "Events"],
];

const NAV_LINK = "border-b-2 py-1 font-sans text-xs font-semibold tracking-caps text-ink uppercase no-underline";

interface PageAction {
  href: string;
  label: string;
  icon: typeof PlusIcon;
}

// a page's own primary action, shown in the bar while that page is: an icon
// button on the right, on every screen size
function pageAction(pathname: string, profile: Profile): PageAction | null {
  const [section, id] = pathname.split("/").slice(1);
  // your own profile page is where you edit it
  if (section === "profile" && id === String(profile.id)) return { href: "/profile/edit", label: "Edit profile", icon: PencilIcon };
  return null;
}

/* The menu on a page with several things to offer, in place of a single
   action: what can be done from where you are. The Events list's makes an
   event or a meeting. New circle starts it wherever it was chosen (the
   city at the root, or the neighborhood whose page it's on); a neighborhood
   adds posting on its bulletin, for a member of a Circle in it, and on your
   own, inviting your neighbors (its poster) and, once someone else lives
   there, Hi, neighbor (learning their names). */
function pageMenu(pathname: string, circles: Circle[], profile: Profile): TopBarMenuItem[] | null {
  // the event form still has its own Event/Meeting switch (a circle page's
  // Events tab opens it too); these just start it on one or the other
  if (pathname === "/events") {
    return [
      { label: "New event", href: "/events/new", icon: CalendarIcon },
      { label: "New meeting", href: "/events/new?kind=meeting", icon: UserGroupIcon },
    ];
  }
  if (pathname === "/circles") return [{ label: "New circle", href: "/circles/new", icon: RingIcon }];
  const [section, id, sub] = pathname.split("/").slice(1);
  if (section !== "circles" || !id || sub) return null;
  const circle = circles.find((c) => c.id === id);
  if (circle?.type !== "neighborhood") return null;
  const items: TopBarMenuItem[] = [{ label: "New circle", href: `/circles/new?parent=${id}`, icon: RingIcon }];
  if (postingCirclesFor(profile.id, circle, circles).length > 0) items.push({ label: "Post on bulletin", href: `/circles/${id}/bulletin/new`, icon: PlusIcon });
  if (circle.id === profile.homeCircleId) {
    items.push({ label: "Invite neighbors", href: `/circles/${id}/poster`, icon: UserPlusIcon });
    if (circle.members.some((m) => m !== profile.id)) items.push({ label: "Hi, neighbor", href: "/game", icon: PlayIcon, iconClassName: "text-teal" });
  }
  return items;
}

// the title for every route under app/(app)/. A circle or event page is titled
// by its name; a lookup that misses (the page is about to 404) falls back to
// its section, so the bar never shows an id
function pageTitle(pathname: string, circles: Circle[], events: Event[], members: Member[], resources: CircleResource[]): string {
  const [section, id, sub, item] = pathname.split("/").slice(1);
  if (section === "circles") {
    if (!id) return "Circles";
    if (id === "new") return "New circle";
    if (sub === "manage") return item === "details" ? "Details" : item === "roles" ? "Roles" : item === "wiki" ? "Wiki" : item === "inbox" ? "Inbox" : "Manage circle";
    // a neighborhood's bulletin takes posts, proposed by the Circles in it
    if (sub === "bulletin" && item) return circles.find((c) => c.id === id)?.type === "neighborhood" ? "New post" : resourceFormTitle(resources.find((r) => r.id === item)?.icon);
    if (sub === "invite") return "Invite";
    if (sub === "poster") return "Invite neighbors";
    if (sub === "tasks" && item) return item === "new" ? "New task" : "Task";
    if (sub === "inbox" && item) return "Message";
    if (sub === "write") return "New message";
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
  if (section === "game") return "Hi, neighbor";
  if (section === "settings") return id === "notifications" ? "Notifications" : id === "availability" ? "Meeting availability" : id === "appearance" ? "Appearance" : "Settings";
  if (section === "admin") return id === "photos" ? "New photo" : id === "applications" && sub ? "Application" : "Review";
  if (section === "invitations") return "Invitation";
  if (section === "proposals") return "Proposal";
  return "Home";
}

// each section's icon, beside its tab's label on desktop
const CIRCLE_SECTION_ICON: Record<CircleSection, ComponentType<SVGProps<SVGSVGElement>>> = {
  bulletin: MegaphoneIcon,
  tasks: CheckCircleIcon,
  inbox: InboxIcon,
  decisions: HandRaisedIcon,
  wiki: BookOpenIcon,
  members: UsersIcon,
  events: CalendarIcon,
};

/* A circle's page has its sections as a tab row, the bar's second line, so it
   stays put as the page scrolls: on /circles/[id] (its default section) and
   /circles/[id]/[section], for a circle with a page. */
function circleTabs(pathname: string, circles: Circle[], profile: Profile): { circle: Circle; sections: CircleSection[]; active: CircleSection } | null {
  const [section, id, sub, item] = pathname.split("/").slice(1);
  if (section !== "circles" || !id || id === "new" || item || (sub && !isCircleSection(sub))) return null;
  const circle = circles.find((c) => c.id === id);
  if (!circle || !circleHasPage(circle)) return null;
  const isMember = isCircleMember(circle, profile.id);
  const sections = circleSections(circle, isMember);
  return { circle, sections, active: isCircleSection(sub) ? sub : defaultCircleSection(circle, isMember) };
}

export function TopBar({ onReselect }: { onReselect: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { circles, events, members, resources, profile, messages, proposals } = useAppState();
  const needsAttention = useHomeNeedsAttention();
  const isHomeNeighborhood =profile.homeCircleId !== null && pathname === `/circles/${profile.homeCircleId}`;

  // Like Flutter's automatic leading back button: shown on every route except
  // the tab roots. A page with unsaved changes can intercept it; otherwise it
  // goes back without ever leaving the app (see useGoBack).
  const isTabRoot = TABS.some(([href]) => pathname === href);
  const action = pageAction(pathname, profile);
  const menu = pageMenu(pathname, circles, profile);
  const tabs = circleTabs(pathname, circles, profile);
  // what a circle's tab counts: its Inbox's unread open messages, and its open proposals
  const sectionCount = (key: CircleSection, circleId: string) =>
    key === "inbox" ? messages.filter((m) => m.circleId === circleId && !m.read && !m.doneAt).length : key === "decisions" ? openProposalsFor(proposals, circleId).length : 0;
  const { shown: pageOwn, run: runPageOwn } = useCurrentTopBarAction();
  const ownMenu = useCurrentTopBarMenu();
  const runBackHandler = useRunBackHandler();
  // Hi, neighbor is played from your neighborhood's page, which its URL can't say
  const goBackInApp = useGoBack(pathname === "/game" && profile.homeCircleId ? `/circles/${profile.homeCircleId}` : undefined);

  function goBack() {
    if (runBackHandler()) return;
    goBackInApp();
  }

  // the tab this page belongs to, if any (the same rule as BottomNav's)
  const currentTab = activeTab(pathname);

  // Installed as an app, the bar lies over AppShell's scrolling <main> instead
  // of above it, so the page scrolls up under its lower edge, fading out as it
  // reaches the title row (solid white behind it), as in a native app; <main> is padded down by the bar's height, published here
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
      className={clsx(
        "app-chrome sticky top-0 z-50 pt-[env(safe-area-inset-top)] standalone:absolute standalone:inset-x-0",
        // with a tab row it's solid, the row's hairline its edge; otherwise it
        // fades from white behind the title to clear at its foot
        tabs ? "bg-paper" : "bg-linear-to-b from-paper from-55% via-paper/80 via-80% to-transparent",
      )}
    >
      {/* the title on the left, the page's action on the right, and on desktop the
          tabs centred on the bar itself (not between the two), so a long title
          can't push them off-centre: it stops short of them instead */}
      <div className="relative mx-auto flex h-14.5 max-w-270 items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-1 min-[720px]:max-w-[calc(50%-9rem)]">
          {!isTabRoot && <GhostIconButton icon={ArrowLeftIcon} label="Back" onClick={goBack} className="-ml-3" />}
          <span className="truncate font-sans text-lg font-extrabold tracking-heading">
            {pageTitle(pathname, circles, events, members, resources)}
          </span>
          {isHomeNeighborhood && <HomeIcon className="ml-1 size-5 shrink-0 text-teal" strokeWidth={2} aria-label="Your neighborhood" />}
        </div>

        {/* a page's own action (see useTopBarAction) takes the slot over a
            link-style one */}
        {pageOwn?.variant === "primary" || pageOwn?.variant === "propose" ? (
          <button
            type="button"
            onClick={runPageOwn}
            disabled={pageOwn.disabled}
            aria-label={pageOwn.label}
            className={clsx(ICON_BUTTON_SLOT, "cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default")}
          >
            <IconButtonCircle icon={pageOwn.icon} variant={pageOwn.variant} />
          </button>
        ) : pageOwn ? (
          <button
            type="button"
            onClick={runPageOwn}
            disabled={pageOwn.disabled}
            aria-label={pageOwn.label}
            className="-mr-3 flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink disabled:cursor-default disabled:text-faint"
          >
            <pageOwn.icon className="size-6" strokeWidth={2} />
          </button>
        ) : ownMenu && ownMenu.length > 0 ? (
          // a page's own menu (an event's: Edit, Share, Add to calendar)
          <TopBarMenu label="More" face={<MenuIconFace icon={EllipsisHorizontalIcon} />} items={ownMenu} />
        ) : pathname === "/home" ? (
          // Home's is the member's own photo, opening their profile and Settings
          <ProfileMenu />
        ) : menu ? (
          <TopBarMenu label="More" face={<MenuIconFace icon={EllipsisHorizontalIcon} />} items={menu} />
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
      {tabs && (
        // its sections, in line with the page beneath (PageContainer's normal
        // width). Switching replaces the URL rather than adding a step for
        // Back to retrace; the section showing goes back to its top.
        <div className="mx-auto max-w-220 px-6">
          <SimpleTabs
            tabs={tabs.sections.map((key) => ({ key, label: CIRCLE_SECTION_LABEL[key], icon: CIRCLE_SECTION_ICON[key], count: sectionCount(key, tabs.circle.id) }))}
            active={tabs.active}
            onChange={(key) => (key === tabs.active ? onReselect() : router.replace(`/circles/${tabs.circle.id}/${key}`))}
          />
        </div>
      )}
      <OfflineBanner />
    </div>
  );
}
