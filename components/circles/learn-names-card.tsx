import { PlayIcon } from "@heroicons/react/24/solid";

/* The name game, as the first card among a neighborhood's people (your own
   neighborhood's): shaped like a MemberCard, its photo a teal play button,
   so it sits with the faces it's about. */
export function LearnNamesCard({ toMeet, onPlay }: { toMeet: number; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="ink-press flex cursor-pointer items-center gap-4 border-r border-b border-ink bg-paper p-5 text-left">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal text-paper">
        <PlayIcon className="ml-1 size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="font-sans text-base font-extrabold tracking-[-0.01em]">Learn names</div>
        <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{toMeet === 1 ? "1 neighbor to meet" : `${toMeet} neighbors to meet`}</span>
      </div>
    </button>
  );
}
