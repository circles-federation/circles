"use client";

import { useEffect, useRef, useState } from "react";
import { GameResultsPage } from "./game-results.page";
import { GameRoundPage } from "./game-round.page";
import { bestStreak, buildRounds, type Round } from "@/lib/game.util";
import { readGameMemory, writeGameMemory } from "@/lib/hi-neighbor";
import type { Member, Profile } from "@/lib/types";

interface HiNeighborPageProps {
  members: Member[];
  profile: Profile;
  onExit: () => void;
}

// how long a right answer shows before the next face
const ADVANCE_MS = 1500;

/* Hi, neighbor: learning the names of the people in your neighborhood, ten
   faces a game. A right answer moves on by itself after a moment; a wrong
   one waits for Next, so there's time to take in who it was. At the end, the
   score, the best streak, and the faces missed, which come up first next
   game (remembered on this device, lib/hi-neighbor.ts). Built in the browser
   only (the route waits until it's there), since it's shuffled. */
export function HiNeighborPage({ members, profile, onExit }: HiNeighborPageProps) {
  const [memory, setMemory] = useState(() => readGameMemory(profile.id));
  const [rounds, setRounds] = useState<Round[]>(() => buildRounds(members, profile.homeCircleId, profile.id, memory.missed));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // each round answered so far: right or not
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  // the best streak before this game, so the end can say when it's beaten
  const [bestBefore, setBestBefore] = useState(memory.best);

  const round = rounds[idx];
  const right = picked !== null && picked === round?.person.name;

  function choose(name: string) {
    if (picked !== null || !round) return;
    setPicked(name);
    setResults((r) => [...r, name === round.person.name]);
  }

  function next() {
    if (idx + 1 < rounds.length) {
      setIdx((i) => i + 1);
      setPicked(null);
      return;
    }
    const missed = rounds.filter((_, i) => !results[i]).map((r) => r.person.id);
    const saved = { missed, best: Math.max(memory.best, bestStreak(results)) };
    writeGameMemory(profile.id, saved);
    setBestBefore(memory.best);
    setMemory(saved);
    setDone(true);
  }

  // a right answer moves on by itself, timed from the answer alone (not
  // restarted by a re-render while it waits), calling next as it is by then
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });
  useEffect(() => {
    if (!right) return;
    const timer = setTimeout(() => nextRef.current(), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [right, idx]);

  function restart() {
    setRounds(buildRounds(members, profile.homeCircleId, profile.id, memory.missed));
    setIdx(0);
    setPicked(null);
    setResults([]);
    setDone(false);
  }

  if (done) {
    return (
      <GameResultsPage
        score={results.filter(Boolean).length}
        rounds={rounds}
        results={results}
        streak={bestStreak(results)}
        newBest={bestStreak(results) > bestBefore}
        onRestart={restart}
        onExit={onExit}
      />
    );
  }
  if (!round) return null;
  return <GameRoundPage key={idx} round={round} results={results} roundsLength={rounds.length} picked={picked} advanceMs={ADVANCE_MS} onChoose={choose} onNext={next} />;
}
