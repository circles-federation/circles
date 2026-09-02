"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS: [string, string][] = [
  ["/home", "Home"],
  ["/directory", "Directory"],
  ["/events", "Events"],
];

export function TopBar() {
  const pathname = usePathname();

  // a tab is "active" if the current route is it or a nested route beneath
  // it, or (for Home) one of the sibling pages reached only from Home. Every
  // org page (Council folder view, org detail, or manage) lives under
  // /directory regardless of how deep the org sits in the hierarchy — see
  // lib/hooks.js's openOrg — so the generic case below covers it.
  function isActive(href: string): boolean {
    if (href === "/home") return pathname === "/home" || pathname === "/game" || pathname.startsWith("/profile");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // mobile has no room for both a brand mark and the current section, so it
  // shows the section name instead — just the top-level name (e.g.
  // "Directory"), never the name of an org/neighborhood being browsed
  // within it, at least for now. Reuses TABS/isActive rather than a second
  // route-to-label list. pathname is available identically on server and
  // client for a given route, so this is safe to compute unconditionally —
  // only which of the two (brand link vs section name) is visible is a
  // breakpoint-driven CSS toggle, not a JS/hydration-sensitive one.
  function currentSectionName() {
    const tab = TABS.find(([href]) => isActive(href));
    if (tab) return tab[1];
    if (pathname.startsWith("/federation")) return "Federation";
    return "Providence";
  }

  return (
    <div className="sticky top-0 z-50 bg-paper shadow-[0_2px_6px_rgba(10,10,10,0.08)]">
      <div className="mx-auto flex h-14.5 max-w-270 items-center justify-between px-6">
        <Link href="/federation" className="hidden border-none bg-transparent p-0 text-inherit no-underline min-[720px]:block">
          <span className="font-sans text-lg font-extrabold tracking-[-0.02em]">Providence</span>
        </Link>
        <span className="font-sans text-lg font-extrabold tracking-[-0.02em] min-[720px]:hidden">
          {currentSectionName()}
        </span>

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
