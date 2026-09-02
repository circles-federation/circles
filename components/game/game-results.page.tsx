"use client";

import { BackButton, Eyebrow } from "@/components/shared";

interface GameResultsPageProps {
  score: number;
  roundsLength: number;
  onRestart: () => void;
  onExit: () => void;
}

/* The name game's end screen: final score plus Play again / Done. These two
   buttons share a border between them (Done drops its own left border
   rather than doubling up against Play again's right one), which is why
   they stay bespoke instead of two separate Button components. */
export function GameResultsPage({ score, roundsLength, onRestart, onExit }: GameResultsPageProps) {
  const pct = Math.round((score / roundsLength) * 100);

  return (
    <div className="mx-auto max-w-170 px-6 pt-7 pb-16">
      <BackButton onClick={onExit}>Home</BackButton>
      <Eyebrow className="mt-7 block text-soft">Round complete</Eyebrow>
      <div className="mt-3.5 font-sans text-hero font-extrabold tracking-[-0.04em] leading-[0.9]">
        {score}<span className="text-faint">/{roundsLength}</span>
      </div>
      <p className="mt-4.5 max-w-[32em] font-serif text-lg leading-normal">
        You named {score} of your {roundsLength} neighbors — {pct}%. Knowing each other by name is the
        smallest unit of solidarity. Run it again whenever new neighbors join.
      </p>
      <div className="mt-7 flex">
        <button
          onClick={onRestart}
          className="btn-invert btn-ink cursor-pointer border border-ink bg-ink px-6 py-3.25 font-sans text-xs font-bold tracking-wide text-paper uppercase"
        >
          Play again
        </button>
        <button
          onClick={onExit}
          className="ink-press cursor-pointer border border-l-0 border-ink bg-paper px-6 py-3.25 font-sans text-xs font-bold tracking-wide text-ink uppercase"
        >
          Done
        </button>
      </div>
    </div>
  );
}
