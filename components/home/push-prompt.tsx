"use client";

import { useState, useSyncExternalStore } from "react";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { Button, EyebrowGroup, Section, useToast } from "@/components/shared";
import { sendTestPushAction } from "@/lib/db/actions";
import { usePushSubscription } from "@/lib/hooks";
import { isInstalledApp } from "@/lib/viewport";

const noSubscribe = () => () => {};
const dev = process.env.NODE_ENV !== "production";

/* Home's way to turn on push notifications for this device, until settings
   have a place for it. Only in the installed app: that's the only place an
   iPhone offers push, and an Android or desktop tab is left alone to match.
   Development shows it in a tab too, along with a test button once it's on,
   to check the whole path. It goes away once push is on. */
export function PushPrompt() {
  // false on the server and during hydration, so the markup matches
  const installed = useSyncExternalStore(noSubscribe, isInstalledApp, () => false);
  const { status, subscribe } = usePushSubscription();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!(installed || dev) || status === "unknown" || status === "unsupported") return null;
  if (status === "on" && !dev) return null;

  async function turnOn() {
    setBusy(true);
    try {
      if (await subscribe()) showToast({ message: "Notifications are on for this device.", tone: "success" });
    } catch (err) {
      console.error(err);
      // development says why, since a phone's console is hard to get at
      const why = dev && err instanceof Error ? ` (${err.name}: ${err.message})` : "";
      showToast({ message: `Couldn't turn on notifications. Try again.${why}`, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    const result = await sendTestPushAction();
    if (!result.ok) showToast({ message: result.error, tone: "error" });
  }

  return (
    <Section>
      <EyebrowGroup label="Notifications">
        {status === "off" && (
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="ink-press flex w-full cursor-pointer items-center gap-3.5 border border-ink bg-paper px-4.5 py-4 text-left text-ink disabled:cursor-default"
          >
            <BellAlertIcon className="size-6 shrink-0" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block font-sans text-base font-bold">Turn on notifications</span>
              <span className="mt-0.5 block font-serif text-base leading-snug text-soft">
                New events, changes, reminders and announcements from your circles.
              </span>
            </span>
          </button>
        )}
        {status === "denied" && (
          <p className="font-serif text-base leading-normal text-soft">
            Notifications are blocked for Circles. To get them, turn them on for Circles in your device&rsquo;s Settings.
          </p>
        )}
        {status === "on" && dev && (
          <Button variant="secondary" onClick={sendTest}>
            Send a test notification
          </Button>
        )}
      </EyebrowGroup>
    </Section>
  );
}
