"use client";

import { useState } from "react";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { Button, ConfirmModal, MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import type { NotificationSettings } from "@/lib/types";

interface SettingsPageProps {
  notifications: NotificationSettings;
  onLogout: () => void;
}

// what Notifications is set to, under its row
function notificationsSummary({ email, push }: NotificationSettings): string {
  if (email && push) return "Email and push";
  if (email) return "Email only";
  if (push) return "Push only";
  return "Off";
}

/* Settings, reached from Home's top bar: a menu like iOS's Settings, each row
   opening a page of its own, with logging out at the foot. */
export function SettingsPage({ notifications, onLogout }: SettingsPageProps) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Settings) is the page's only heading */}
        <Section className="pt-0">
          <div className="flex flex-col gap-3">
            <MenuRow href="/profile/edit" label="Edit profile" detail="Your photo, bio, and more" />
            <MenuRow href="/settings/notifications" label="Notifications" detail={notificationsSummary(notifications)} />
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
