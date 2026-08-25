"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  HomeIcon as HomeOutline,
  FolderIcon as DirectoryOutline,
  CalendarDaysIcon as EventsOutline,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeSolid,
  FolderIcon as DirectorySolid,
  CalendarDaysIcon as EventsSolid,
} from "@heroicons/react/24/solid";

const TABS = [
  { href: "/home", label: "Home", outline: HomeOutline, solid: HomeSolid },
  { href: "/directory", label: "Directory", outline: DirectoryOutline, solid: DirectorySolid },
  { href: "/events", label: "Events", outline: EventsOutline, solid: EventsSolid },
];

/* Mobile-only bottom nav, replacing the top bar's hamburger menu: same
   destinations as TopBar's desktop nav, icon + label stacked per tab.
   Visibility is a CSS breakpoint (matching TopBar's `min-[720px]:flex`), not
   useIsMobile — that hook reads window width in state, which the server
   can't know, so gating render on it produces a hydration mismatch on the
   very first paint below the breakpoint. */
export function BottomNav() {
  const pathname = usePathname();

  // mirrors TopBar's isActive: Home also covers the game and profile pages,
  // which are reached only from Home and have no bottom-nav tab of their
  // own; Directory also covers individual org pages, which still live under
  // /organizations — see top-bar.jsx's isActive for why.
  function isActive(href) {
    if (href === "/home") return pathname === "/home" || pathname === "/game" || pathname.startsWith("/profile");
    if (href === "/directory") return pathname.startsWith("/directory") || pathname.startsWith("/organizations");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex min-[720px]:hidden fixed bottom-0 inset-x-0 z-50 border-t border-faint bg-paper shadow-[0_-2px_6px_rgba(10,10,10,0.08)]">
      {TABS.map(({ href, label, outline: Outline, solid: Solid }) => {
        const active = isActive(href);
        const Icon = active ? Solid : Outline;
        const color = active ? "text-ink" : "text-soft";
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-4"
          >
            <Icon className={clsx("size-6", color)} />
            <span className={clsx("font-sans text-micro tracking-wide uppercase font-bold", color)}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
