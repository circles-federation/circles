"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INK, PAPER, TYPE, sans } from "@/lib/theme";

const TABS = [
  ["/home", "Home"],
  ["/people", "People"],
  ["/organizations", "Organizations"],
  ["/events", "Events"],
];

export function TopBar() {
  const pathname = usePathname();

  // a tab is "active" if the current route is it, a nested route beneath it,
  // or (for Home) one of the sibling pages reached only from Home
  function isActive(href) {
    if (href === "/home") return pathname === "/home" || pathname === "/game" || pathname.startsWith("/profile");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div
      className="sticky top-0 z-50 shadow-[0_2px_6px_rgba(10,10,10,0.08)]"
      style={{ background: PAPER }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
        <Link href="/federation" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "none", color: "inherit" }}>
          <span style={{ fontFamily: sans, fontWeight: 800, letterSpacing: "-0.02em", fontSize: TYPE.lg }}>Providence</span>
        </Link>

        {/* on mobile, these four destinations live in BottomNav instead —
            hidden via CSS breakpoint (not useIsMobile) so this never has to
            reconcile a server/client mismatch on the first paint */}
        <div className="hidden min-[720px]:flex items-center gap-6">
          <nav style={{ display: "flex", gap: 24 }}>
            {TABS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase",
                  fontWeight: 600, padding: "4px 0", color: INK, textDecoration: "none",
                  borderBottom: `2px solid ${isActive(href) ? INK : "transparent"}`,
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
