"use client";

import { useState, useSyncExternalStore } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { Button, Section, useToast } from "@/components/shared";
import { usePushSubscription } from "@/lib/hooks";
import { markPushPromptAnswered, pushPromptAnswered } from "@/lib/push-client";
import { isIPhoneBrowserTab } from "@/lib/viewport";

const noSubscribe = () => () => {};

/* Home's one-time offer to turn on push for this device. Asked here first,
   with the browser's own prompt only in answer to Turn on: a browser asks
   for permission once, and a refusal there can only be undone in the
   device's settings, while Not now leaves that chance unspent. Shown only
   where it could work and hasn't been decided: push supported and not yet
   asked of the browser (an iPhone's browser tab can't push at all; the
   welcome page offers installing), and not answered on this device, here or
   in Settings → Notifications, which is the way back after Not now. */
export function PushPrompt() {
  const { profile, saveNotificationSettings } = useAppState();
  const { showToast } = useToast();
  const device = usePushSubscription();
  const answeredBefore = useSyncExternalStore(noSubscribe, pushPromptAnswered, () => true);
  const iPhoneTab = useSyncExternalStore(noSubscribe, isIPhoneBrowserTab, () => true);
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);

  if (answeredBefore || answered || iPhoneTab || device.status !== "off") return null;

  async function turnOn() {
    setBusy(true);
    try {
      // while still inside the tap: a browser only asks in answer to one
      if (await device.subscribe()) {
        markPushPromptAnswered();
        setAnswered(true);
        // the member-wide switch still gates every push (see Settings)
        if (!profile.notifications.push) {
          const result = await saveNotificationSettings({ ...profile.notifications, push: true });
          if (!result.ok) console.error(result.error);
        }
        showToast({ tone: "success", title: "Notifications are on", message: "This device will be notified when your circles need you." });
      } else {
        // refused at the browser's prompt: there's no asking again from here
        markPushPromptAnswered();
        setAnswered(true);
        showToast({ tone: "error", title: "Notifications are blocked", message: "They can be allowed in this device's settings. Settings → Notifications says how." });
      }
    } catch (err) {
      console.error(err);
      showToast({ tone: "error", message: "Couldn't turn on notifications. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function notNow() {
    markPushPromptAnswered();
    setAnswered(true);
  }

  return (
    <Section>
      <div className="flex items-start gap-4 border border-ink p-5">
        <BellIcon className="mt-0.5 size-6 shrink-0" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-sans text-base font-extrabold">Turn on notifications</h2>
          <p className="mt-1.5 font-serif text-sm leading-normal text-soft">
            Get notified on this device when your circles need you: proposals to answer, invitations, and changes to events you&rsquo;re going to. You can change this anytime in Settings.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button size="compact" onClick={turnOn} disabled={busy}>Turn on</Button>
            <Button size="compact" variant="secondary" onClick={notNow} disabled={busy}>Not now</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
