"use client";

import { PageContainer, MastheadGlow } from "@/components/shared";
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

/* The member's landing page: a greeting, then what's starting now, their
   circles, the way into everything else, the one-time prompts, what's waiting
   on them, what's next on their calendar, and their tasks. Who they are is the
   top bar's photo, which opens their profile and Settings.

   From 960px it's two columns under a wide hero: the greeting at display size
   with Starting soon beside it, then Needs you, Up next and My tasks on the
   left, and My circles (a grid rather than a shelf) and the prompts on the
   right. The same sections in the same order on a phone, where the columns
   dissolve (`contents`) and `order` interleaves them back into one. */
export function Home({ profile, events, rsvpState }: HomeProps) {
  return (
    <PageContainer size="wide">
      {/* each section takes itself out when it has nothing to show (empty:hidden
          keeps its wrapper from leaving a gap), so the gap is the one rhythm
          between whatever's left */}
      <div className="relative isolate flex flex-col gap-10 min-[960px]:grid min-[960px]:grid-cols-[1.15fr_1fr] min-[960px]:gap-x-12">
        <MastheadGlow tall />
        <div className="-order-1 flex flex-col gap-6 min-[960px]:col-span-2 min-[960px]:grid min-[960px]:grid-cols-[1fr_380px] min-[960px]:items-end min-[960px]:gap-12 min-[960px]:pt-8">
          <Greeting name={profile.name} />
          <div className="empty:hidden">
            <StartingSoon events={events} memberId={profile.id} rsvpState={rsvpState} />
          </div>
        </div>
        <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
          <div className="order-5 empty:hidden"><NeedsYou /></div>
          <div className="order-6 empty:hidden"><UpNext /></div>
          <div className="order-7 empty:hidden"><MyTasks /></div>
        </div>
        <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
          <div className="order-3 empty:hidden"><MyCircles /></div>
          <div className="order-4 empty:hidden"><HomePrompts /></div>
        </div>
      </div>
    </PageContainer>
  );
}
