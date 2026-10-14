"use client";

import { useState, useSyncExternalStore } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { Button, useToast } from "@/components/shared";
import type { Prompt } from "./prompt-deck";
import { usePushSubscription } from "@/lib/hooks";
import { markPushPromptAnswered, pushPromptAnswered } from "@/lib/push-client";
import { isIPhoneBrowserTab } from "@/lib/viewport";

const noSubscribe = () => () => {};

export type PushPromptState = ReturnType<typeof usePushPrompt>;

/* Home's one-time offer to turn on push for this device. Asked here first,
   with the browser's own prompt only in answer to Turn on: a browser asks
   for permission once, and a refusal there can only be undone in the
   device's settings, while Not now leaves that chance unspent. Wanted only
   where it could work and hasn't been decided: push supported and not yet
   asked of the browser (an iPhone's browser tab can't push at all; the
   welcome page offers installing), and not answered on this device, here or
   in Settings → Notifications, which is the way back after Not now.
   `wanted` is null until this device's push status is known. */
export function usePushPrompt() {
  const { profile, saveNotificationSettings } = useAppState();
  const { showToast } = useToast();
  const device = usePushSubscription();
  const answeredBefore = useSyncExternalStore(noSubscribe, pushPromptAnswered, () => true);
  const iPhoneTab = useSyncExternalStore(noSubscribe, isIPhoneBrowserTab, () => true);
  // answered on this visit
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);

  const decided = answeredBefore || answered || iPhoneTab;
  const wanted = decided ? false : device.status === "unknown" ? null : device.status === "off";

  function answer() {
    markPushPromptAnswered();
    setAnswered(true);
  }

  async function turnOn() {
    setBusy(true);
    try {
      // while still inside the tap: a browser only asks in answer to one
      if (await device.subscribe()) {
        answer();
        // the member-wide switch still gates every push (see Settings)
        if (!profile.notifications.push) {
          const result = await saveNotificationSettings({ ...profile.notifications, push: true });
          if (!result.ok) console.error(result.error);
        }
        showToast({ tone: "success", title: "Notifications are on", message: "This device will be notified when your circles need you." });
      } else {
        // refused at the browser's prompt: there's no asking again from here
        answer();
        showToast({ tone: "error", title: "Notifications are blocked", message: "They can be allowed in this device's settings. Settings → Notifications says how." });
      }
    } catch (err) {
      console.error(err);
      showToast({ tone: "error", message: "Couldn't turn on notifications. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return { wanted, answered, busy, turnOn, notNow: answer };
}

// the push prompt as one of PromptDeck's cards
export function pushPrompt(prompt: PushPromptState): Prompt {
  return {
    id: "push",
    icon: BellIcon,
    title: "Turn on notifications",
    body: "Get notified on this device when your circles need you: proposals to answer, invitations, and changes to events you’re going to. You can change this anytime in Settings.",
    actions: (
      <>
        <Button size="compact" onClick={prompt.turnOn} disabled={prompt.busy}>Turn on</Button>
        <Button size="compact" variant="secondary" onClick={prompt.notNow} disabled={prompt.busy}>Not now</Button>
      </>
    ),
  };
}
