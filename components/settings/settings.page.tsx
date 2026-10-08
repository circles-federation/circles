"use client";

import { useState } from "react";
import { ArrowRightStartOnRectangleIcon, BellIcon, DevicePhoneMobileIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { Button, ConfirmModal, MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { usePushSubscription } from "@/lib/hooks";
import { formatPhone } from "@/lib/phone.util";
import type { NotificationSettings } from "@/lib/types";

interface SettingsPageProps {
  notifications: NotificationSettings;
  phone?: string;
  smsStopped?: boolean;
  onLogout: () => void;
}

// what Notifications is set to, under its row: email and texts for the
// member, push for this device (as that page sets them)
function notificationsSummary(email: boolean, sms: boolean, push: boolean): string {
  const ways = [email && "email", sms && "text", push && "push on this device"].filter((w): w is string => !!w);
  if (ways.length === 0) return "Off";
  const said = ways.length === 1 ? ways[0]! : `${ways.slice(0, -1).join(", ")} and ${ways[ways.length - 1]}`;
  return said.charAt(0).toUpperCase() + said.slice(1);
}

/* Settings, reached from Home's top bar: a menu like iOS's Settings, each row
   opening a page of its own, with logging out at the foot. */
export function SettingsPage({ notifications, phone, smsStopped, onLogout }: SettingsPageProps) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const device = usePushSubscription();
  // left blank until this device's push has been read, rather than changing
  // under the reader a moment later
  const summary = device.status === "unknown" ? undefined : notificationsSummary(notifications.email, notifications.sms && !!phone && !smsStopped, notifications.push && device.status === "on");

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Settings) is the page's only heading */}
        <Section className="pt-0">
          <div className="flex flex-col gap-3">
            <MenuRow href="/profile/edit" icon={UserCircleIcon} label="Edit profile" detail="Your photo, bio, and more" />
            <MenuRow href="/settings/notifications" icon={BellIcon} label="Notifications" detail={summary} />
            <MenuRow href="/settings/phone" icon={DevicePhoneMobileIcon} label="Phone number" detail={phone ? formatPhone(phone) : "Add one to get texts"} />
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
