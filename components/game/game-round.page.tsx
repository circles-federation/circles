"use client";

import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button } from "@/components/shared";
import { avatarFor } from "@/lib/members.util";
import type { Round } from "@/lib/game.util";

interface GameRoundPageProps {
  round: Round;
  // each round answered so far, right or not, this one included once it is
  results: boolean[];
  roundsLength: number;
  picked: string | null;
  // how long a right answer shows before the next face, for its countdown
  advanceMs: number;
  onChoose: (name: string) => void;
  onNext: () => void;
}

// a run of right answers, counting back from the latest
function currentStreak(results: boolean[]): number {
  let run = 0;
  for (let i = results.length - 1; i >= 0 && results[i]; i--) run++;
  return run;
}

/* One face of Hi, neighbor, built for a phone held in one hand: the game's
   progress along the top (a segment a face, green or red once answered) and
   the streak; the photo as big as the screen leaves room for, with a tilted
   "Who's this?" sticker; and the names stacked at the foot, under the thumb.
   Answered, their name and what they do are stamped on the photo. Right, the
   name goes green with a +1, and it moves on by itself (the line under the
   names counting down); wrong, the pick goes red, theirs green, the other
   names go, and Next waits. */
export function GameRoundPage({ round, results, roundsLength, picked, advanceMs, onChoose, onNext }: GameRoundPageProps) {
  const m = round.person;
  const answered = picked !== null;
  const right = picked === m.name;
  const idx = answered ? results.length - 1 : results.length;
  const streak = currentStreak(results);
  const about = [m.role, m.pronouns].filter(Boolean).join(" · ");

  return (
    // the screen below the top bar, the names at its foot whatever its height
    <div className="mx-auto flex min-h-[calc(100dvh-var(--top-bar-height,4rem))] max-w-120 flex-col px-6 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" role="progressbar" aria-label="Faces" aria-valuemin={0} aria-valuemax={roundsLength} aria-valuenow={results.length}>
          {Array.from({ length: roundsLength }, (_, i) => (
            <span
              key={i}
              className={clsx(
                "h-1.5 flex-1",
                i < results.length ? (results[i] ? "bg-leaf" : "bg-danger") : i === idx ? "bg-ink" : "bg-faint",
              )}
            />
          ))}
        </div>
        <span className={clsx("font-sans text-base font-extrabold whitespace-nowrap", streak === 0 && "text-ghost")} aria-label={`Streak: ${streak}`}>
          🔥 {streak}
        </span>
      </div>

      {/* as wide as the column, unless the screen's too short for that and the
          names both, when it gives way (never under 12rem) */}
      <div className="relative mx-auto mt-6 aspect-square w-full max-w-[max(12rem,calc(100dvh-28rem))]">
        {/* eslint-disable-next-line @next/next/no-img-element -- a neighbor's photo, by version */}
        <img src={avatarFor(m)} alt="A neighbor" className="size-full border border-ink object-cover" />
        {!answered ? (
          <span className="absolute -top-4 left-3 -rotate-4 border-[3px] border-ink bg-paper px-3 py-1.5 font-sans text-xl leading-none font-extrabold tracking-display">
            Who’s this?
          </span>
        ) : (
          <>
            {right && <span className="absolute top-3 right-3 rotate-4 bg-leaf px-2.5 py-1.5 font-sans text-lg leading-none font-extrabold text-paper">+1</span>}
            {/* who it was, stamped on: what's learned whether it was right or not */}
            <div className="absolute inset-x-3 bottom-3 -rotate-2 border-[3px] border-ink bg-paper px-4 py-2.5" aria-live="polite">
              <div className="font-sans text-title leading-none font-extrabold tracking-display">{m.name}</div>
              {about && <div className="mt-1 font-serif text-base text-soft">{about}</div>}
            </div>
          </>
        )}
      </div>

      <div className="min-h-6 flex-1" />

      <div className="flex flex-col gap-3">
        {round.options.map((name) => {
          const isRight = name === m.name;
          const isPicked = name === picked;
          // wrong, only the pick and the right name stay, with Next under them
          if (answered && !right && !isRight && !isPicked) return null;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChoose(name)}
              disabled={answered}
              className={clsx(
                "flex h-14 items-center justify-between border-2 px-5 text-left font-sans text-lg font-extrabold tracking-snug",
                !answered && "ink-press cursor-pointer border-ink bg-paper text-ink",
                answered && isRight && "border-leaf bg-leaf text-paper",
                answered && isPicked && !isRight && "border-danger bg-paper text-danger",
                answered && !isRight && !isPicked && "border-faint bg-paper text-ghost",
              )}
            >
              {name}
              {answered && isRight && <CheckCircleIcon className="size-6 shrink-0" strokeWidth={2} aria-label="Right" />}
              {answered && isPicked && !isRight && <XMarkIcon className="size-6 shrink-0" strokeWidth={2.5} aria-label="Not this one" />}
            </button>
          );
        })}
        {answered && right && (
          // the moment before the next face, running out
          <div className="h-1 bg-faint" aria-hidden>
            <div className="h-1 origin-left bg-leaf motion-safe:animate-countdown" style={{ animationDuration: `${advanceMs}ms` }} />
          </div>
        )}
        {answered && !right && (
          <Button onClick={onNext} className="h-14 w-full">
            {idx + 1 >= roundsLength ? "See how you did" : "Next"}
          </Button>
        )}
      </div>
    </div>
  );
}
