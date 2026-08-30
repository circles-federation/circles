"use client";

import { useState } from "react";
import { useAppState } from "@/components/providers/app-state-provider";
import { MEMBERS } from "@/lib/data";
import { GameResultsPage } from "./game-results.page";
import { GameRoundPage } from "./game-round.page";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(homeHood, excludeId) {
  // the game is for learning your direct neighbors, so it draws only from the
  // player's own neighborhood, minus the player themselves — you already know who you are
  const neighbors = MEMBERS.filter((m) => m.neighborhood === homeHood && m.id !== excludeId);
  const pool = shuffle(neighbors);
  return pool.map((person) => {
    const distractors = shuffle(neighbors.filter((m) => m.id !== person.id)).slice(0, 3);
    const options = shuffle([person, ...distractors]).map((m) => m.name);
    return { person, options };
  });
}

/* Orchestrates the name-learning game: builds a shuffled round set for the
   player's own neighborhood, then renders either the current round
   (GameRoundPage) or the end screen (GameResultsPage) once every round has
   been answered. */
export function NameGamePage({ onExit }) {
  const { profile } = useAppState();
  const [rounds, setRounds] = useState(() => buildRounds(profile.neighborhood, profile.id));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const answered = picked !== null;

  function choose(name) {
    if (answered) return;
    setPicked(name);
    if (name === rounds[idx].person.name) setScore((s) => s + 1);
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
    setRounds(buildRounds(profile.neighborhood, profile.id));
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
      round={rounds[idx]}
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
