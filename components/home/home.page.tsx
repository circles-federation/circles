"use client";

import { useState } from "react";
import { PlayIcon } from "@heroicons/react/24/solid";
import { AlertModal, Eyebrow, PageContainer } from "@/components/shared";
import { HomePrompts } from "./home-prompts";
import { MyCircles } from "./my-circles";
import { MyTasks } from "./my-tasks";
import { NeedsYou } from "./needs-you";
import { StartingSoon } from "./starting-soon";
import { UpNext } from "./up-next";
import { circleNeighborhood, indexCircles } from "@/lib/circles.util";
import { useMembers } from "@/lib/hooks";
import type { Circle, Event, Profile } from "@/lib/types";

interface HomeProps {
  profile: Profile;
  events: Event[];
  circles: Circle[];
  rsvpState: Record<string, boolean>;
  onOpenNeighbors: () => void;
  onOpenLocalCircles: () => void;
  onPlayGame: () => void;
}

/* The member's landing page: their circles first, the way into everything
   else (a shelf, so joining more doesn't push the rest down), then what's
   starting now, the one-time prompts, what's waiting on them, what's next on
   their calendar, their tasks, and their neighborhood. Who they are is the
   top bar's photo, which opens their profile and Settings. */
export function Home({ profile, events, circles, rsvpState, onOpenNeighbors, onOpenLocalCircles, onPlayGame }: HomeProps) {
  const members = useMembers();
  const byId = indexCircles(circles);
  const homeCircle = profile.homeCircleId ? byId[profile.homeCircleId] : undefined;
  const neighbors = members.filter((m) => profile.homeCircleId !== null && m.homeCircleId === profile.homeCircleId);
  // the name game quizzes you on everyone in your neighborhood but you, so with
  // no one else there (or no neighborhood) there's nothing to play: say why
  // instead of opening an empty game
  const [noGame, setNoGame] = useState(false);
  const canPlay = neighbors.some((m) => m.id !== profile.id);
  function playGame() {
    if (canPlay) onPlayGame();
    else setNoGame(true);
  }
  // excludes the neighborhood itself — clicking this stat opens that
  // neighborhood's folder page, which shows its children, not itself, so the
  // count would otherwise be one higher than what's actually there to click
  // through to.
  const localCircles = circles.filter((c) => c.type !== "neighborhood" && !!homeCircle && circleNeighborhood(c, byId)?.id === homeCircle.id);

  return (
    <PageContainer size="wide">
      {/* each section takes itself out when it has nothing to show, so the
          gap is the one rhythm between whatever's left */}
      <div className="flex flex-col gap-10">
        <MyCircles />
        <StartingSoon events={events} memberId={profile.id} rsvpState={rsvpState} />
        <HomePrompts />
        <NeedsYou />
        <UpNext />
        <MyTasks />

        {/* my neighborhood, in one short row: its size as two links into
            it, and the name game */}
        {homeCircle && (
          <section className="border-t border-faint pt-5">
            {/* the heading over the whole row, not beside the button, so
                its wide-set caps don't wrap on a small phone */}
            <Eyebrow className="text-soft">My neighborhood</Eyebrow>
            <div className="mt-1 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-serif text-base text-soft">
                  <button onClick={onOpenNeighbors} className="hit cursor-pointer border-none bg-transparent p-0 font-serif text-base whitespace-nowrap text-soft underline underline-offset-3">
                    {neighbors.length === 1 ? "1 neighbor" : `${neighbors.length} neighbors`}
                  </button>
                  {" · "}
                  <button onClick={onOpenLocalCircles} className="hit cursor-pointer border-none bg-transparent p-0 font-serif text-base whitespace-nowrap text-soft underline underline-offset-3">
                    {localCircles.length === 1 ? "1 circle" : `${localCircles.length} circles`}
                  </button>
                </div>
              </div>
              {/* the round button inverts while pressed, its label staying put */}
              <button
                onClick={playGame}
                title="Learn your neighbors' names"
                className="fill-press flex shrink-0 cursor-pointer items-center gap-3 border-none bg-transparent p-0 font-sans text-xs font-bold tracking-caps text-teal uppercase"
              >
                {/* on the narrowest phones just the button, so the counts keep a line */}
                <span className="max-[379px]:sr-only">Learn names</span>
                <span className="fill-press-square flex size-11 items-center justify-center rounded-full border-2 border-teal bg-teal text-paper [--press-color:var(--color-teal)]">
                  <PlayIcon className="ml-0.5 size-5" />
                </span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* pulled down into PageContainer's bottom padding, so on a phone it
          sits just above the bottom nav once scrolled to the very end */}
      <p className="mt-16 -mb-14 text-center font-sans text-label tracking-wide text-soft opacity-60 select-none">
        Circles R1 Beta 1
      </p>

      {noGame && (
        <AlertModal
          title="No neighbors to meet yet"
          message={homeCircle
            ? `You're the only member of ${homeCircle.name} so far. The game helps you learn your neighbors' names, so it'll be ready once someone else joins.`
            : "The game helps you learn your neighbors' names, but you're not part of a neighborhood yet."}
          onClose={() => setNoGame(false)}
        />
      )}
    </PageContainer>
  );
}
