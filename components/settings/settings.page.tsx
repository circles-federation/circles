"use client";

import { useState } from "react";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { Button, ConfirmModal, MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { usePushSubscription } from "@/lib/hooks";
import type { AvailabilityWindow, NotificationSettings } from "@/lib/types";

interface SettingsPageProps {
  notifications: NotificationSettings;
  availability: AvailabilityWindow[] | null;
  onLogout: () => void;
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

/* Settings, reached from Home's top bar: a menu like iOS's Settings, each row
   opening a page of its own, with logging out at the foot. */
export function SettingsPage({ notifications, availability, onLogout }: SettingsPageProps) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const device = usePushSubscription();
  // left blank until this device's push has been read, rather than changing
  // under the reader a moment later
  const summary = device.status === "unknown" ? undefined : notificationsSummary(notifications.email, notifications.push && device.status === "on");

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Settings) is the page's only heading */}
        <Section className="pt-0">
          <div className="flex flex-col gap-3">
            <MenuRow href="/profile/edit" label="Edit profile" detail="Your photo, bio, and more" />
            <MenuRow href="/settings/notifications" label="Notifications" detail={summary} />
            <MenuRow href="/settings/availability" label="Meeting availability" detail={availabilitySummary(availability)} />
          </div>
        </Section>

        <Section>
          <Button variant="danger" onClick={() => setConfirmingLogout(true)} className="w-full">
            <ArrowRightStartOnRectangleIcon className="size-3.5" strokeWidth={2.5} />
            Log out
          </Button>
        </Section>
      </SectionGroup>

      {confirmingLogout && (
        <ConfirmModal
          title="Log out?"
          message="You'll need a new code from your email to sign back in."
          confirmLabel="Log out"
          cancelLabel="Stay"
          onConfirm={onLogout}
          onCancel={() => setConfirmingLogout(false)}
        />
      )}
    </PageContainer>
  );
}
