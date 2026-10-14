"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import clsx from "clsx";
import { Section } from "@/components/shared";
import { PromptCard } from "./prompt-card";

export interface Prompt {
  // stable, so the deck can tell a newly dealt card from the one before
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: ReactNode;
  actions: ReactNode;
}

// the sheets drawn behind the top card, however many more are waiting
const MAX_EDGES = 2;
// each sheet peeks 8px further below the one above it: the room under the
// top card, and each sheet's place, by how many sheets there are
const ROOM = ["", "pb-2", "pb-4"];
const EDGE: Record<number, string[]> = {
  1: ["inset-x-2.5 top-2 bottom-0"],
  2: ["inset-x-2.5 top-2 bottom-2", "inset-x-5 top-4 bottom-0"],
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Home's one-time prompts as a deck of cards: the first one waiting is on
   top, and only it can be acted on; the rest show as the edges of the
   sheets under it. Answering one (which takes it out of `prompts`) slides it
   off and deals the next up into its place; with reduced motion it simply
   changes. The corner counts through the deck as it was when Home opened:
   "1 of 2", then "2 of 2". */
export function PromptDeck({ prompts }: { prompts: Prompt[] }) {
  const top = prompts[0];
  const [total, setTotal] = useState(prompts.length);
  if (prompts.length > total) setTotal(prompts.length);

  // what was on top last render: when it's gone from the deck, it's the
  // card leaving, drawn over the next as it slides off; and the next was
  // dealt, so it comes up from the stack (but not on first showing)
  const [prevTop, setPrevTop] = useState(top);
  const [leaving, setLeaving] = useState<Prompt | null>(null);
  const [dealt, setDealt] = useState<string | null>(null);
  if (top?.id !== prevTop?.id) {
    setPrevTop(top);
    const animate = !reducedMotion();
    if (prevTop && !prompts.some((p) => p.id === prevTop.id) && animate) setLeaving(prevTop);
    if (prevTop && top && animate) setDealt(top.id);
  }

  if (!top && !leaving) return null;
  const edges = Math.min(prompts.length - 1, MAX_EDGES);
  const position = total - prompts.length + 1;

  return (
    <Section>
      <div className={clsx("relative transition-[padding] duration-200", ROOM[Math.max(edges, 0)])}>
        {/* deepest first, so each sheet lies under the one above it */}
        {(EDGE[edges] ?? []).map((place, i) => ({ place, depth: i + 1 })).reverse().map(({ place, depth }) => (
          <div key={depth} aria-hidden className={clsx("absolute border border-ink bg-paper", place)} />
        ))}
        {top && (
          <div key={top.id} className={clsx("relative", dealt === top.id && "animate-deal-in")}>
            <PromptCard icon={top.icon} title={top.title} actions={top.actions} corner={total > 1 ? `${position} of ${total}` : undefined}>
              {top.body}
            </PromptCard>
          </div>
        )}
        {leaving && (
          <div
            key={`leaving-${leaving.id}`}
            aria-hidden
            inert
            className="pointer-events-none absolute inset-x-0 top-0 z-10 animate-deal-out"
            onAnimationEnd={() => setLeaving(null)}
          >
            <PromptCard icon={leaving.icon} title={leaving.title} actions={leaving.actions}>
              {leaving.body}
            </PromptCard>
          </div>
        )}
      </div>
    </Section>
  );
}
