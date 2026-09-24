"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRunBackHandler } from "@/components/providers/back-handler-provider";

const TABS: [string, string][] = [
  ["/home", "Home"],
  ["/circles", "Circles"],
  ["/events", "Events"],
];

// where Back goes when there's no in-app history to pop (the page was opened
// directly, from a link or a reload): one URL segment up, except for pages
// that only Home links to, whose own parent segment isn't a route
function parentRoute(pathname: string): string {
  const parent = pathname.replace(/\/[^/]+\/?$/, "");
  if (parent === "" || parent === "/profile") return "/home";
  return parent;
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Like Flutter's automatic leading back button: shown on every route except
  // the tab roots. TopBar is mounted once in AppShell, so counting pathname
  // changes tells us whether router.back() would stay inside the app or leave
  // it for whatever site linked here.
  const isTabRoot = TABS.some(([href]) => pathname === href);
  const navigations = useRef(-1);
  useEffect(() => {
    navigations.current += 1;
  }, [pathname]);

  const runBackHandler = useRunBackHandler();

  function goBack() {
    if (runBackHandler()) return;
    if (navigations.current > 0) router.back();
    else router.push(parentRoute(pathname));
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

  // mobile has no room for both a brand mark and the current section, so it
  // shows the section name instead — just the top-level name (e.g.
  // "Circles"), never the name of a circle being browsed
  // within it, at least for now. Reuses TABS/isActive rather than a second
  // route-to-label list. pathname is available identically on server and
  // client for a given route, so this is safe to compute unconditionally —
  // only which of the two (brand link vs section name) is visible is a
  // breakpoint-driven CSS toggle, not a JS/hydration-sensitive one.
  function currentSectionName() {
    const tab = TABS.find(([href]) => isActive(href));
    return tab ? tab[1] : "Providence";
  }

  return (
    <div className="sticky top-0 z-50 bg-paper shadow-[0_2px_6px_rgba(10,10,10,0.08)]">
      <div className="mx-auto flex h-14.5 max-w-270 items-center justify-between px-6">
        <div className="flex items-center gap-1">
          {!isTabRoot && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="-ml-2.5 flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink"
            >
              <ArrowLeftIcon className="size-6" strokeWidth={2} />
            </button>
          )}
          <span className="hidden font-sans text-lg font-extrabold tracking-[-0.02em] min-[720px]:block">Providence</span>
          <span className="font-sans text-lg font-extrabold tracking-[-0.02em] min-[720px]:hidden">
            {currentSectionName()}
          </span>
        </div>

        {/* on mobile, these three destinations live in BottomNav instead —
            hidden via CSS breakpoint (not useIsMobile) so this never has to
            reconcile a server/client mismatch on the first paint. */}
        <nav className="hidden gap-6 min-[720px]:flex">
          {TABS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "border-b-2 py-1 font-sans text-xs font-semibold tracking-wide text-ink uppercase no-underline",
                isActive(href) ? "border-b-ink" : "border-b-transparent",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
