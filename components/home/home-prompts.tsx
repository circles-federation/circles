"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ClockIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { Button } from "@/components/shared";
import { PromptDeck, type Prompt } from "./prompt-deck";
import { useInstallPrompt } from "./install-app-prompt";
import { pushPrompt, usePushPrompt } from "./push-prompt";
import { circleCanHoldMeetings, circlesForMember, isRootCircle } from "@/lib/circles.util";
import { availabilityPromptKey, markPromptAnswered, profilePromptKey, promptAnswered } from "@/lib/home-prompts";
import { isProfileBlank } from "@/lib/members.util";

const noSubscribe = () => () => {};

// whether a prompt's Not now has been tapped, on this device (see
// lib/home-prompts.ts), and tapping it
function useNotNow(key: string): [boolean, () => void] {
  const before = useSyncExternalStore(noSubscribe, () => promptAnswered(key), () => true);
  const [now, setNow] = useState(false);
  return [
    before || now,
    () => {
      markPromptAnswered(key);
      setNow(true);
    },
  ];
}

/* Home's one-time prompts, in the order they're dealt (see PromptDeck):
   installing the app always on top, wherever it's not installed and the
   browser can (the rest work better installed), then turning on push (it's about this device, and can only be asked in
   answer to a tap), then filling in a profile that's still as applying left
   it, then saying when you can do meetings. Each leaves the deck once it's
   answered or no longer applies; the profile and availability prompts' main
   buttons aren't answers, since they go once there's something filled in.
   Nothing shows until this device's push status is known, so the deck
   doesn't reshuffle as it loads. */
export function HomePrompts() {
  const { profile, circles } = useAppState();
  const router = useRouter();
  const install = useInstallPrompt();
  const push = usePushPrompt();
  const [profileDismissed, dismissProfile] = useNotNow(profilePromptKey(profile.id));
  const [availabilityDismissed, dismissAvailability] = useNotNow(availabilityPromptKey(profile.id));

  if (push.wanted === null) return null;
  const prompts: Prompt[] = [];
  if (install.prompt) prompts.push(install.prompt);
  if (push.wanted) prompts.push(pushPrompt(push));

  if (!profileDismissed && isProfileBlank(profile)) {
    prompts.push({
      id: "profile",
      icon: UserCircleIcon,
      title: "Tell your neighbors about yourself",
      body: "A few details, like what you do, the languages you speak and a line about yourself, help neighbors put a name to a face, find someone who can lend a hand, and start a conversation.",
      actions: (
        <>
          <Button size="compact" onClick={() => router.push("/profile/edit")}>Edit profile</Button>
          <Button size="compact" variant="secondary" onClick={dismissProfile}>Not now</Button>
        </>
      ),
    });
  }

  // null is never set; [] is set to not available, which is an answer. Only
  // asked of someone in a circle that holds meetings, where it's used.
  const meets = circlesForMember(profile.id, circles).some((c) => !isRootCircle(c) && circleCanHoldMeetings(c));
  if (!availabilityDismissed && profile.availability === null && meets) {
    prompts.push({
      id: "availability",
      icon: ClockIcon,
      title: "Say when you can meet",
      body: "Set the times you’re usually free, and whoever plans a meeting in your circles can see who can make the time they pick. They see only whether you’re free around that time, never your whole schedule.",
      actions: (
        <>
          <Button size="compact" onClick={() => router.push("/settings/availability")}>Set times</Button>
          <Button size="compact" variant="secondary" onClick={dismissAvailability}>Not now</Button>
        </>
      ),
    });
  }

  return (
    <>
      <PromptDeck prompts={prompts} />
      {install.steps}
    </>
  );
}
