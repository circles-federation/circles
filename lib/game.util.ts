import type { Member } from "./types";

export interface Round {
  person: Member;
  options: string[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function buildRounds(members: Member[], homeHood: string, excludeId: number): Round[] {
  // the game is for learning your direct neighbors, so it draws only from the
  // player's own neighborhood, minus the player themselves — you already know who you are
  const neighbors = members.filter((m) => m.neighborhood === homeHood && m.id !== excludeId);
  const pool = shuffle(neighbors);
  return pool.map((person) => {
    const distractors = shuffle(neighbors.filter((m) => m.id !== person.id)).slice(0, 3);
    const options = shuffle([person, ...distractors]).map((m) => m.name);
    return { person, options };
  });
}
