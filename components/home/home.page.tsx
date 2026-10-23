"use client";

import { PageContainer } from "@/components/shared";
import { Greeting } from "./greeting";
import { HomePrompts } from "./home-prompts";
import { MyCircles } from "./my-circles";
import { MyTasks } from "./my-tasks";
import { NeedsYou } from "./needs-you";
import { StartingSoon } from "./starting-soon";
import { UpNext } from "./up-next";
import type { Event, Profile } from "@/lib/types";

interface HomeProps {
  profile: Profile;
  events: Event[];
  rsvpState: Record<string, boolean>;
}

/* The member's landing page: a greeting, then their circles, the way into
   everything else (a shelf, so joining more doesn't push the rest down),
   then what's starting now, the one-time prompts, what's waiting on them,
   what's next on their calendar, and their tasks. Who they are is the top bar's photo,
   which opens their profile and Settings. */
export function Home({ profile, events, rsvpState }: HomeProps) {
  return (
    <PageContainer size="wide">
      {/* each section takes itself out when it has nothing to show, so the
          gap is the one rhythm between whatever's left */}
      <div className="flex flex-col gap-10">
        <Greeting name={profile.name} />
        <MyCircles />
        <StartingSoon events={events} memberId={profile.id} rsvpState={rsvpState} />
        <HomePrompts />
        <NeedsYou />
        <UpNext />
        <MyTasks />
      </div>
    </PageContainer>
  );
}
