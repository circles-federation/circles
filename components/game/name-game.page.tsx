"use client";

import { useState } from "react";
import { GameResultsPage } from "./game-results.page";
import { GameRoundPage } from "./game-round.page";
import { buildRounds, type Round } from "@/lib/game.util";
import type { Member, Profile } from "@/lib/types";

interface NameGamePageProps {
  members: Member[];
  profile: Profile;
  onExit: () => void;
}

/* Orchestrates the name-learning game: builds a shuffled round set for the
   player's own neighborhood, then renders either the current round
   (GameRoundPage) or the end screen (GameResultsPage) once every round has
   been answered. */
export function NameGamePage({ members, profile, onExit }: NameGamePageProps) {
  const [rounds, setRounds] = useState<Round[]>(() => buildRounds(members, profile.homeCircleId, profile.id));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const answered = picked !== null;

  function choose(name: string) {
    if (answered) return;
    setPicked(name);
    if (name === rounds[idx]!.person.name) setScore((s) => s + 1);
  }

  function next() {
    if (idx + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  }

  function restart() {
    setRounds(buildRounds(members, profile.homeCircleId, profile.id));
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }

  if (done) {
    return <GameResultsPage score={score} roundsLength={rounds.length} onRestart={restart} onExit={onExit} />;
  }

  return (
    <GameRoundPage
      round={rounds[idx]!}
      idx={idx}
      roundsLength={rounds.length}
      score={score}
      picked={picked}
      answered={answered}
      onChoose={choose}
      onNext={next}
      onExit={onExit}
    />
  );
}
