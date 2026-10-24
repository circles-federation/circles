import type { Member } from "./types";

export interface Round {
  person: Member;
  options: string[];
}

// how many faces a game is: a minute or so, rather than the whole neighborhood
export const GAME_SIZE = 10;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* A game of Hi, neighbor: up to GAME_SIZE of the player's own neighbors (not
   themselves, whom they know), each with their name among up to three
   others'. Those they missed last time (`missedFirst`) come first, the rest
   at random, so the faces they don't know yet come round again. Random, so
   build it in the browser only: built on the server too, the two wouldn't
   match. */
export function buildRounds(members: Member[], homeCircleId: string | null, excludeId: number, missedFirst: number[] = []): Round[] {
  const neighbors = members.filter((m) => homeCircleId !== null && m.homeCircleId === homeCircleId && m.id !== excludeId);
  const missed = shuffle(neighbors.filter((m) => missedFirst.includes(m.id)));
  const rest = shuffle(neighbors.filter((m) => !missedFirst.includes(m.id)));
  return shuffle([...missed, ...rest].slice(0, GAME_SIZE)).map((person) => {
    const distractors = shuffle(neighbors.filter((m) => m.id !== person.id)).slice(0, 3);
    return { person, options: shuffle([person, ...distractors]).map((m) => m.name) };
  });
}

// the longest run of right answers in a row
export function bestStreak(results: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const right of results) {
    run = right ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
