"use client";

import { BellIcon, ClockIcon, SwatchIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { usePushSubscription } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";
import { themeByKey } from "@/lib/themes.util";
import type { AvailabilityWindow, NotificationSettings } from "@/lib/types";

interface SettingsPageProps {
  notifications: NotificationSettings;
  availability: AvailabilityWindow[] | null;
}

// what Notifications is set to, under its row: email for the member, push
// for this device (as that page sets them)
function notificationsSummary(email: boolean, push: boolean): string {
  if (email && push) return "Email, and push on this device";
  if (email) return "Email";
  if (push) return "Push on this device";
  return "Off";
}

// what Meeting availability is set to, under its row
function availabilitySummary(windows: AvailabilityWindow[] | null): string {
  if (windows === null) return "Not set";
  if (windows.length === 0) return "No times";
  return windows.length === 1 ? "1 window" : `${windows.length} windows`;
}

/* Settings, reached from Home's top bar menu (which also logs out): a menu
   like iOS's Settings, each row opening a page of its own, with which version
   this is at the foot. */
export function SettingsPage({ notifications, availability }: SettingsPageProps) {
  const device = usePushSubscription();
  // left blank until this device's push has been read, rather than changing
  // under the reader a moment later
  const theme = useTheme();
  // what this device looks like: Automatic says which it's come to
  const appearance = theme && (theme.choice === "auto" ? `Automatic · ${themeByKey(theme.theme).label} now` : themeByKey(theme.theme).label);
  const summary = device.status === "unknown" ? undefined : notificationsSummary(notifications.email, notifications.push && device.status === "on");

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Settings) is the page's only heading */}
        <Section className="pt-0">
          <div className="flex flex-col gap-3">
            <MenuRow href="/profile/edit" icon={UserCircleIcon} label="Edit profile" detail="Your photo, bio, and more" />
            <MenuRow href="/settings/notifications" icon={BellIcon} label="Notifications" detail={summary} />
            <MenuRow href="/settings/availability" icon={ClockIcon} label="Meeting availability" detail={availabilitySummary(availability)} />
            <MenuRow href="/settings/appearance" icon={SwatchIcon} label="Appearance" detail={appearance ?? undefined} />
          </div>
        </Section>

        <Section>
          {/* which Circles this is, for a bug report */}
          <p className="text-center font-sans text-label tracking-wide text-soft select-none">Circles R1 Beta 2</p>
        </Section>
      </SectionGroup>
    </PageContainer>
  );
}
