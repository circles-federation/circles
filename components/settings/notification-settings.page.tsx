"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { Button, ConfirmModal, EyebrowGroup, PageContainer, Section, SectionGroup, Switch, useToast } from "@/components/shared";
import { sendTestPushAction } from "@/lib/db/actions";
import { usePushSubscription } from "@/lib/hooks";
import { markPushPromptAnswered } from "@/lib/push-client";
import type { NotificationSettings } from "@/lib/types";
import { isIPhoneBrowserTab } from "@/lib/viewport";

interface NotificationSettingsPageProps {
  settings: NotificationSettings;
  // whether there's an address to email at all
  hasEmail: boolean;
  onSave: (settings: NotificationSettings) => Promise<MutationResult>;
  onBack: () => void;
}

const noSubscribe = () => () => {};
const dev = process.env.NODE_ENV !== "production";

/* How a member is told about things: by email, on or off for them
   everywhere, and by push, on or off for this device (its browser's own
   subscription). Like
   any form here, nothing changes until the top bar's Save, and Back asks
   before discarding. */
export function NotificationSettingsPage({ settings, hasEmail, onSave, onBack }: NotificationSettingsPageProps) {
  const { showToast } = useToast();
  const device = usePushSubscription();
  const iPhoneTab = useSyncExternalStore(noSubscribe, isIPhoneBrowserTab, () => false);
  const [draft, setDraft] = useState(settings);
  // this device's push, as chosen here: null until it's touched
  const [deviceWanted, setDeviceWanted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const deviceOn = device.status === "on";
  const deviceChanged = deviceWanted !== null && deviceWanted !== deviceOn;
  // the member-wide push switch isn't shown (each device's own switch says
  // where pushes go), but it still gates them, so turning push on here turns
  // it back on for someone who switched it off when it was shown
  const toSave = { ...draft, push: draft.push || deviceWanted === true };
  const settingsChanged = toSave.email !== settings.email || toSave.push !== settings.push;
  const dirty = deviceChanged || settingsChanged;

  async function handleSave() {
    setSaving(true);
    setError(null);
    // this device first, while still inside the tap on Save: a browser only
    // asks for permission to push in answer to one
    if (deviceChanged) {
      // decided here, so Home's prompt has nothing left to ask
      markPushPromptAnswered();
      try {
        if (deviceWanted) {
          if (!(await device.subscribe())) {
            setDeviceWanted(null);
            setError("Notifications are blocked for Circles on this device, so it can't get push notifications.");
            setSaving(false);
            return;
          }
        } else {
          await device.unsubscribe();
        }
      } catch (err) {
        console.error(err);
        const why = dev && err instanceof Error ? ` (${err.name}: ${err.message})` : "";
        setError(`Couldn't change notifications on this device. Try again.${why}`);
        setSaving(false);
        return;
      }
    }
    if (settingsChanged) {
      const result = await onSave(toSave);
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }
    showToast({ tone: "success", title: "Changes saved", message: "Your notification settings have been updated." });
    onBack();
  }

  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Save changes", icon: CheckIcon, onAction: handleSave, disabled: !dirty || saving, variant: "primary" });

  async function sendTest() {
    const result = await sendTestPushAction();
    if (!result.ok) showToast({ message: result.error, tone: "error" });
  }

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Notifications) is the page's only heading */}
        <Section className="pt-0">
          <EyebrowGroup label="Email">
            <SettingRows>
              <SettingRow
                label="Email notifications"
                detail={hasEmail ? "New events, changes, reminders, announcements, invitations and the daily digest." : "There's no email address on your account."}
                checked={hasEmail && draft.email}
                onChange={(email) => setDraft((d) => ({ ...d, email }))}
                disabled={!hasEmail}
              />
            </SettingRows>
            <p className="mt-3 font-serif text-sm leading-normal text-soft">Sign-in codes are always emailed.</p>
          </EyebrowGroup>
        </Section>

        <Section>
          <EyebrowGroup label="Push">
            <SettingRows>
              <DeviceRow status={device.status} iPhoneTab={iPhoneTab} checked={deviceWanted ?? deviceOn} onChange={setDeviceWanted} />
            </SettingRows>
            {dev && deviceOn && deviceWanted === null && (
              <Button variant="secondary" onClick={sendTest} className="mt-4">
                Send a test notification
              </Button>
            )}
          </EyebrowGroup>
        </Section>
      </SectionGroup>

      {error && <p className="mt-2 font-sans text-sm font-bold text-danger">{error}</p>}

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to your notification settings. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}

// a list of settings: rows under an ink rule, hairlines between them, an ink
// rule under the last (as LinkRow's lists are)
function SettingRows({ children }: { children: ReactNode }) {
  return <div className="border-t border-ink">{children}</div>;
}

function RowShell({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-4 border-b border-faint py-3.5 last:border-b-ink">{children}</div>;
}

function SettingRow({ label, detail, checked, onChange, disabled }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <RowShell>
      <div className="min-w-0 flex-1">
        <div id={id} className="font-sans text-base font-bold">
          {label}
        </div>
        <div className="mt-0.5 font-serif text-sm leading-snug text-soft">{detail}</div>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} disabled={disabled} />
    </RowShell>
  );
}

/* Push is per device, as on a phone: this one gets pushes or it doesn't. A
   switch where it can, and otherwise why not — an iPhone only offers push to
   the installed app, and notifications blocked in the device's own settings
   can only be unblocked there. */
function DeviceRow({ status, iPhoneTab, checked, onChange }: { status: ReturnType<typeof usePushSubscription>["status"]; iPhoneTab: boolean; checked: boolean; onChange: (on: boolean) => void }) {
  if (status === "unknown") return null;
  if (status === "on" || status === "off") {
    return <SettingRow label="Push notifications" detail="Get notifications on this device." checked={checked} onChange={onChange} />;
  }
  const why =
    status === "denied"
      ? "Blocked for Circles on this device. Turn them on in your device's Settings."
      : iPhoneTab
        ? "Add Circles to your Home Screen to get them on this iPhone."
        : "This browser can't get them.";
  return (
    <RowShell>
      <div className="min-w-0 flex-1">
        <div className="font-sans text-base font-bold">Push notifications</div>
        <div className="mt-0.5 font-serif text-sm leading-snug text-soft">{why}</div>
      </div>
    </RowShell>
  );
}
