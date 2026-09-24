"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProfileModal } from "@/components/circles/profile-modal";
import { useAppNav } from "@/lib/hooks";
import type { Member } from "@/lib/types";

interface ProfileModalContextValue {
  open: (m: Member) => void;
  close: () => void;
}

/* The member-profile modal is a global overlay, not a route — it can be
   opened from a dozen different pages (circles, event attendee lists, circle
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

  return (
    <ProfileModalContext.Provider value={{ open, close }}>
      {children}
      {member && (
        <ProfileModal
          member={member}
          onClose={close}
          onOpenCircle={(c) => { close(); nav.openCircle(c); }}
        />
      )}
    </ProfileModalContext.Provider>
  );
}
