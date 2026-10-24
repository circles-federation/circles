/* What Hi, neighbor remembers between games, on this device, per member: the
   neighbors they last missed (who come up first next game) and their best
   streak. In this browser's storage, so a private window or cleared site
   data starts afresh, which costs nothing but the head start. */

export interface GameMemory {
  missed: number[];
  best: number;
}

const key = (memberId: number) => `hi-neighbor:${memberId}`;

export function readGameMemory(memberId: number): GameMemory {
  try {
    const saved = JSON.parse(localStorage.getItem(key(memberId)) ?? "null") as Partial<GameMemory> | null;
    return { missed: Array.isArray(saved?.missed) ? saved.missed.filter((id) => typeof id === "number") : [], best: typeof saved?.best === "number" ? saved.best : 0 };
  } catch {
    return { missed: [], best: 0 };
  }
}

export function writeGameMemory(memberId: number, memory: GameMemory): void {
  try {
    localStorage.setItem(key(memberId), JSON.stringify(memory));
  } catch {
    // storage refused (a private window): next game just starts at random
  }
}
