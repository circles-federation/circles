"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
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
  function isActive(href) {
    if (href === "/home") return pathname === "/home" || pathname === "/game" || pathname.startsWith("/profile");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="sticky top-0 z-50 bg-paper shadow-[0_2px_6px_rgba(10,10,10,0.08)]">
      <div className="mx-auto flex h-14.5 max-w-270 items-center justify-between px-6">
        <Link href="/federation" className="border-none bg-transparent p-0 text-inherit no-underline">
          <span className="font-sans text-lg font-extrabold tracking-[-0.02em]">Providence</span>
        </Link>

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
