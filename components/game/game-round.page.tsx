"use client";

import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button, Eyebrow, PageContainer } from "@/components/shared";
import { avatarFor } from "@/lib/members.util";
import type { Round } from "@/lib/game.util";

interface GameRoundPageProps {
  round: Round;
  idx: number;
  roundsLength: number;
  score: number;
  picked: string | null;
  answered: boolean;
  onChoose: (name: string) => void;
  onNext: () => void;
}

/* One round of the name game: a neighbor's photo, four name options, and
   (once answered) the correct answer plus a Next/See score button. */
export function GameRoundPage({ round, idx, roundsLength, score, picked, answered, onChoose, onNext }: GameRoundPageProps) {
  const m = round.person;

  return (
    <PageContainer size="compact">
      <div className="flex items-baseline justify-between border-b border-ink pb-2.75">
        <Eyebrow>Who is this?</Eyebrow>
        <span className="font-sans text-xs font-extrabold tracking-[0.08em]">
          {String(idx + 1).padStart(2, "0")} / {roundsLength} · Score {score}
        </span>
      </div>

      <div className="-mt-px h-0.5 bg-faint">
        <div className="h-0.5 bg-ink transition-[width] duration-300" style={{ width: `${(idx / roundsLength) * 100}%` }} />
      </div>

      <div className="mt-9 flex justify-center">
        <div className="relative">
          <img
            key={m.id}
            src={avatarFor(m)}
            alt="A neighbor in the federation"
            className="block size-60 border border-ink object-cover"
          />
          <div className="absolute -top-4 -left-4 flex size-10 items-center justify-center rounded-full border border-ink bg-paper font-serif text-xl font-bold">
            ?
          </div>
        </div>
      </div>

      <div className="mt-9 grid grid-cols-2 border border-ink">
        {round.options.map((name, i) => {
          const isCorrect = name === m.name;
          const isPicked = name === picked;
          return (
            <button
              key={name}
              onClick={() => onChoose(name)}
              disabled={answered}
              className={clsx(
                "relative px-4 py-5.5 text-left font-sans text-lg font-bold tracking-[0.01em] transition-colors",
                answered ? "cursor-default" : "cursor-pointer",
                i % 2 === 0 && "border-r border-ink",
                i >= 2 && "border-t border-ink",
                answered && isCorrect ? "bg-ink text-paper" : answered && isPicked ? "bg-paper text-soft" : "bg-paper text-ink",
              )}
            >
              {name}
              {answered && isCorrect && <CheckIcon className="absolute top-1/2 right-4 size-4 -translate-y-1/2" strokeWidth={2.5} />}
              {answered && isPicked && !isCorrect && <XMarkIcon className="absolute top-1/2 right-4 size-4 -translate-y-1/2" strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>

      <div className="mt-7 min-h-15">
        {answered && (
          <div className="flex items-center justify-between gap-5">
            <p className="font-serif text-sm leading-[1.45] text-soft">
              {picked === m.name ? "Right — " : `That's ${m.name}. `}
              <span className="text-ink">{m.name}</span>
              {/* a new member may not have filled these in yet */}
              {(m.role || m.pronouns) && <> · {[m.role, m.pronouns].filter(Boolean).join(", ")}.</>}
            </p>
            <Button onClick={onNext} className="shrink-0">
              {idx + 1 >= roundsLength ? "See score" : "Next"}
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
