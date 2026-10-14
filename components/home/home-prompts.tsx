"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { useAppState } from "@/components/providers/app-state-provider";
import { Button } from "@/components/shared";
import { PromptDeck, type Prompt } from "./prompt-deck";
import { pushPrompt, usePushPrompt } from "./push-prompt";
import { markPromptAnswered, profilePromptKey, promptAnswered } from "@/lib/home-prompts";
import { isProfileBlank } from "@/lib/members.util";

const noSubscribe = () => () => {};

/* Home's one-time prompts, in the order they're dealt (see PromptDeck):
   turning on push first (it's about this device, and can only be asked in
   answer to a tap), then filling in a profile that's still as applying left
   it. Each leaves the deck once it's answered or no longer applies. Nothing
   shows until this device's push status is known, so the deck doesn't
   reshuffle as it loads. */
export function HomePrompts() {
  const { profile } = useAppState();
  const router = useRouter();
  const push = usePushPrompt();
  const key = profilePromptKey(profile.id);
  const profileAnsweredBefore = useSyncExternalStore(noSubscribe, () => promptAnswered(key), () => true);
  const [profileAnswered, setProfileAnswered] = useState(false);

  if (push.wanted === null) return null;
  const prompts: Prompt[] = [];
  if (push.wanted) prompts.push(pushPrompt(push));
  if (!profileAnsweredBefore && !profileAnswered && isProfileBlank(profile)) {
    prompts.push({
      id: "profile",
      icon: UserCircleIcon,
      title: "Tell your neighbors about yourself",
      body: "A few details, like what you do, the languages you speak and a line about yourself, help neighbors put a name to a face, find someone who can lend a hand, and start a conversation.",
      actions: (
        <>
          {/* not an answer: the prompt goes once there's something in it */}
          <Button size="compact" onClick={() => router.push("/profile/edit")}>Edit profile</Button>
          <Button
            size="compact"
            variant="secondary"
            onClick={() => {
              markPromptAnswered(key);
              setProfileAnswered(true);
            }}
          >
            Not now
          </Button>
        </>
      ),
    });
  }
  return <PromptDeck prompts={prompts} />;
}
