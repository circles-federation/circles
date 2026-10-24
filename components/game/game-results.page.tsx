"use client";

import { Button, Eyebrow } from "@/components/shared";
import { avatarFor } from "@/lib/members.util";
import type { Round } from "@/lib/game.util";

interface GameResultsPageProps {
  score: number;
  rounds: Round[];
  // each round, right or not
  results: boolean[];
  // this game's best run of right answers, and whether it beat every game before
  streak: number;
  newBest: boolean;
  onRestart: () => void;
  onExit: () => void;
}

/* The end of a game of Hi, neighbor: the score on a big tilted sticker, the
   best streak, and the faces missed, each with their name and what they do,
   to learn before the next game (where they come up first). Play again and
   Done at the foot, under the thumb, as the names were. */
export function GameResultsPage({ score, rounds, results, streak, newBest, onRestart, onExit }: GameResultsPageProps) {
  const missed = rounds.filter((_, i) => !results[i]).map((r) => r.person);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--top-bar-height,4rem))] max-w-120 flex-col px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <Eyebrow className="text-soft">You met {rounds.length === 1 ? "1 neighbor" : `${rounds.length} neighbors`}</Eyebrow>

      <div className="mt-6 flex items-end gap-5">
        <span className="-rotate-4 border-4 border-ink bg-paper px-4 pt-2.5 pb-1.5 font-sans text-hero leading-[0.9] font-extrabold tracking-display">
          {score}
          <span className="text-ghost">/{rounds.length}</span>
        </span>
        {streak > 0 && (
          <div className="pb-1">
            <div className="font-sans text-base font-extrabold">🔥 Best streak {streak}</div>
            {/* a record worth the name: a run of three or more */}
            {newBest && streak >= 3 && <div className="font-serif text-base text-soft">Your best yet</div>}
          </div>
        )}
      </div>

      {missed.length > 0 ? (
        <>
          <Eyebrow className="mt-10 text-soft">{missed.length === 1 ? "Learn this one" : missed.length === 2 ? "Learn these two" : `Learn these ${missed.length}`}</Eyebrow>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {missed.map((m) => (
              <div key={m.id} className="border border-ink">
                {/* eslint-disable-next-line @next/next/no-img-element -- a neighbor's photo, by version */}
                <img src={avatarFor(m)} alt="" className="aspect-square w-full object-cover" />
                <div className="px-2 py-1.5">
                  <div className="truncate font-sans text-sm font-extrabold tracking-snug">{m.name}</div>
                  {m.role && <div className="truncate font-serif text-sm text-soft">{m.role}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-10 font-serif text-lg leading-normal text-body">You named every one. Play again to meet more of your neighbors.</p>
      )}

      <div className="min-h-8 flex-1" />

      <div className="flex flex-col gap-3">
        <Button accent="teal" onClick={onRestart} className="h-14 w-full">
          Play again
        </Button>
        <Button variant="secondary" onClick={onExit} className="h-13 w-full">
          Done
        </Button>
      </div>
    </div>
  );
}
