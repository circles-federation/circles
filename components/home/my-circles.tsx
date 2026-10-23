"use client";

import { HomeIcon } from "@heroicons/react/24/outline";
import { EmptyState, Eyebrow, PrivateLabel } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_TYPE_LABEL, circlesForMember, isGroup } from "@/lib/circles.util";
import { useAppNav } from "@/lib/hooks";
import { HomeSection } from "./home-section";

/* Your circles as a shelf of small cards that scrolls sideways, running off
   the screen's edge so it's plain there are more, rather than a grid that
   grows the page with every circle joined: each card its type, its name and
   how many people are in it. Your neighborhood first, as you have one. */
export function MyCircles() {
  const { circles, profile } = useAppState();
  const nav = useAppNav();
  const mine = circlesForMember(profile.id, circles).sort((a, b) => Number(b.id === profile.homeCircleId) - Number(a.id === profile.homeCircleId));

  return (
    <HomeSection label="My circles" {...(mine.length > 0 ? { count: mine.length } : {})}>
      {mine.length === 0 ? (
        <EmptyState action={{ label: "Browse circles", href: "/circles" }}>You’re not a member of any circle yet. The circles you join show up here.</EmptyState>
      ) : (
        // bleeds into the page's padding, so the cards run off the edge; py-1
        // keeps a card's keyboard focus ring from being clipped
        <ul className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mine.map((c) => (
            <li key={c.id} className="shrink-0 snap-start">
              <button type="button" onClick={() => nav.openCircle(c)} className="ink-press flex h-30 w-44 cursor-pointer flex-col items-stretch border border-ink bg-paper p-3 text-left text-ink">
                <Eyebrow className="block truncate text-soft">{isGroup(c) ? <PrivateLabel>{CIRCLE_TYPE_LABEL[c.type]}</PrivateLabel> : CIRCLE_TYPE_LABEL[c.type]}</Eyebrow>
                <span className="mt-1.5 line-clamp-2 font-sans text-base leading-tight font-extrabold tracking-[-0.01em]">
                  {c.name}
                  {c.id === profile.homeCircleId && <HomeIcon className="ml-1 inline size-4 align-[-2px] text-teal" strokeWidth={2.5} aria-label="Your neighborhood" />}
                </span>
                <span className="mt-auto font-serif text-sm text-soft">{c.members.length === 1 ? "1 person" : `${c.members.length} people`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}
