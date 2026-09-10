"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProfileModal } from "@/components/directory/profile-modal";
import { useAppNav } from "@/lib/hooks";
import { orgDisplayName } from "@/lib/orgs.util";
import type { Member, Org } from "@/lib/types";
import { useAppState } from "./app-state-provider";

interface ProfileModalContextValue {
  open: (m: Member) => void;
  close: () => void;
}

/* The member-profile modal is a global overlay, not a route — it can be
   opened from a dozen different pages (directory, event attendee lists, org
   member lists, role slots...) and should look identical regardless of where
   it was triggered from. Mounted once in the root layout so it persists
   across navigation, and closes itself whenever the route changes so it
   never lingers over a page it wasn't opened on. */
const ProfileModalContext = createContext<ProfileModalContextValue | null>(null);

export function useProfileModal(): ProfileModalContextValue {
  const ctx = useContext(ProfileModalContext);
  // no-op fallback if used outside a provider, so callers never crash
  return ctx || { open: () => {}, close: () => {} };
}

export function ProfileModalProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const pathname = usePathname();
  const { orgs, events } = useAppState();
  const nav = useAppNav();

  const open = useCallback((m: Member) => setMember(m), []);
  const close = useCallback(() => setMember(null), []);

  // close on navigation — adjusted during render (not an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (member) setMember(null);
  }

  // the modal opens identically from a dozen different pages (directory,
  // attendee lists, org member lists, role slots...), so the org link's back
  // label has to be derived from wherever we actually are, the same way each
  // page-specific route wires its own label — falling back to the org page's
  // own default ("All organizations") when the current page isn't one we
  // have a specific label for.
  function currentPageLabel() {
    if (pathname === "/home") return "Home";
    const orgMatch = pathname.match(/^\/directory\/([^/]+)/);
    if (orgMatch) {
      const org = orgs.find((o) => o.id === orgMatch[1]);
      return org && orgDisplayName(org);
    }
    const eventMatch = pathname.match(/^\/events\/([^/]+)/);
    if (eventMatch) return events.find((e) => e.id === eventMatch[1])?.title;
    return undefined;
  }

  return (
    <ProfileModalContext.Provider value={{ open, close }}>
      {children}
      {member && (
        <ProfileModal
          member={member}
          onClose={close}
          onOpenOrg={(o) => { close(); nav.openOrg(o, currentPageLabel()); }}
        />
      )}
    </ProfileModalContext.Provider>
  );
}
