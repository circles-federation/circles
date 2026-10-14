"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button, InstallStepsModal } from "@/components/shared";
import type { Prompt } from "./prompt-deck";
import { INSTALL_PROMPT_KEY, markPromptAnswered, promptAnswered } from "@/lib/home-prompts";
import { canInstallNatively, installNatively, subscribeInstall } from "@/lib/install";
import { isIPhoneBrowserTab } from "@/lib/viewport";

const noSubscribe = () => () => {};

// how this browser can install it: with the browser's own prompt, by walking
// through an iPhone's Add to Home Screen, or not at all (already installed,
// or a browser with no way to: Firefox, Safari on a Mac)
type InstallWay = "native" | "iphone" | null;
const installWay = (): InstallWay => (canInstallNatively() ? "native" : isIPhoneBrowserTab() ? "iphone" : null);

/* Home's offer to install the app, on top of the deck whenever it's
   wanted: the rest work better installed (an iPhone only allows push in
   the installed app). Not now is remembered on this device. */
export function useInstallPrompt() {
  const way = useSyncExternalStore(subscribeInstall, installWay, () => null);
  const answeredBefore = useSyncExternalStore(noSubscribe, () => promptAnswered(INSTALL_PROMPT_KEY), () => true);
  const [answered, setAnswered] = useState(false);
  const [showingSteps, setShowingSteps] = useState(false);

  function notNow() {
    markPromptAnswered(INSTALL_PROMPT_KEY);
    setAnswered(true);
  }

  async function install() {
    if (way === "iphone") return setShowingSteps(true);
    // installed, it leaves the deck by itself (appinstalled); turned down
    // at the browser's prompt, that offer's used up, so it leaves too
    await installNatively().catch((err) => console.error("Couldn't install:", err));
  }

  const prompt: Prompt | null =
    way && !answeredBefore && !answered
      ? {
          id: "install",
          icon: ArrowDownTrayIcon,
          title: "Install the app",
          body:
            way === "iphone"
              ? "Add Circles to your home screen to open it like any other app. It’s also the only way an iPhone can get notifications from Circles."
              : "Install Circles on this device to open it like any other app, in a window of its own.",
          actions: (
            <>
              <Button size="compact" onClick={install}>Install</Button>
              <Button size="compact" variant="secondary" onClick={notNow}>Not now</Button>
            </>
          ),
        }
      : null;

  const steps = showingSteps ? <InstallStepsModal onClose={() => setShowingSteps(false)} /> : null;
  return { prompt, steps };
}
