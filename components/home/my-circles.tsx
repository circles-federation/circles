"use client";

import { HomeIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, EmptyState, Eyebrow, PrivateLabel } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_TYPE_LABEL, circlesForMember, isGroup } from "@/lib/circles.util";
import { useAppNav, useMemberById } from "@/lib/hooks";
import { HomeSection } from "./home-section";

// how many faces a tile shows
const FACES = 4;

/* Your circles as a shelf of small cards that scrolls sideways, running off
   the screen's edge so it's plain there are more (a phone shows one and a
   half to two), rather than a grid that grows the page with every circle
   joined: each card its type, its name, and a few of its people's faces
   with how many there are. Your neighborhood first, as you have one. */
export function MyCircles() {
  const { circles, profile } = useAppState();
  const nav = useAppNav();
  const memberById = useMemberById();
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
              <button type="button" onClick={() => nav.openCircle(c)} className="ink-press flex h-32 w-52 cursor-pointer flex-col items-stretch border border-ink bg-paper p-3 text-left text-ink">
                <Eyebrow className="block truncate text-soft">{isGroup(c) ? <PrivateLabel>{CIRCLE_TYPE_LABEL[c.type]}</PrivateLabel> : CIRCLE_TYPE_LABEL[c.type]}</Eyebrow>
                <span className="mt-1.5 line-clamp-2 font-sans text-base leading-tight font-extrabold tracking-snug">
                  {c.name}
                  {c.id === profile.homeCircleId && <HomeIcon className="ml-1 inline size-4 align-[-2px] text-teal" strokeWidth={2.5} aria-label="Your neighborhood" />}
                </span>
                {/* a few of its people's faces, and how many there are */}
                <span className="mt-auto flex items-center gap-2">
                  <span className="flex">
                    {c.members.slice(0, FACES).map((id, i) => {
                      const m = memberById(id);
                      return m ? <Avatar key={id} member={m} size={28} className={clsx(i > 0 && "-ml-2")} /> : null;
                    })}
                  </span>
                  <span className="font-serif text-sm text-soft">{c.members.length === 1 ? "1 person" : `${c.members.length} people`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}
