"use client";

import { useMemo } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, EmptyState, Eyebrow } from "@/components/shared";
import { OrdinaryRow } from "./ordinary-row";
import { hasEnded, parseDay } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { useClock, useHistoryState } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface EventFeedProps {
  events: Event[];
  onOpenEvent: (e: Event) => void;
  pageSize?: number;
  emptyText?: string;
  // what to do about an empty feed (create one, go find some)
  emptyAction?: { label: string; href: string };
}

/* A single chronological event feed: upcoming events first (soonest at top).
   Past events are hidden by default (wherever this is reused — the Events
   page and the Home dashboard) and, once revealed via the button below, are
   a "Past events" section of their own after the upcoming list, most recent first. Paginates with "Load more", which appends
   older events. Spacing above the list is the caller's job (e.g.
   home.page.jsx wraps this in an EyebrowGroup), not this component's. */
export function EventFeed({ events, onOpenEvent, pageSize = 12, emptyText = "No events yet.", emptyAction }: EventFeedProps) {
  const now = useClock();
  const { upcoming, past } = useMemo(() => {
    const up: Event[] = [], pa: Event[] = [];
    // a meeting or circle-hosted event isn't listed until its circle has
    // consented to it: until then it's only its proposal (see awaitingConsent)
    events.filter((e) => !awaitingConsent(e)).forEach((e) => (hasEnded(e, now) ? pa : up).push(e));
    up.sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime()); // soonest first
    pa.sort((a, b) => parseDay(b.date).getTime() - parseDay(a.date).getTime()); // most recent first
    return { upcoming: up, past: pa };
  }, [events, now]);

  // kept on the history entry, so coming Back from an event finds the past
  // events still open and as many loaded, at the place it was left
  const [{ showPast, shownCount }, setFeed] = useHistoryState("eventFeed", { showPast: false, shownCount: pageSize });
  const setShowPast = (on: boolean) => setFeed({ showPast: on, shownCount });
  const ordered = showPast ? [...upcoming, ...past] : upcoming;

  const visible = ordered.slice(0, shownCount);
  const remaining = ordered.length - visible.length;
  // past events, once shown, are a section of their own after the upcoming ones
  const upcomingVisible = visible.slice(0, upcoming.length);
  const pastVisible = visible.slice(upcoming.length);

  if (ordered.length === 0) {
    return (
      <>
        <div className="mt-4">
          {/* with past events to show instead, the button below is the way on */}
          {!showPast && past.length > 0 ? <EmptyState>No upcoming events.</EmptyState> : <EmptyState {...(emptyAction ? { action: emptyAction } : {})}>{emptyText}</EmptyState>}
        </div>
        {!showPast && past.length > 0 && (
          <Button variant="secondary" onClick={() => setShowPast(true)} className="mt-3 w-full">
            Show past events
            <span className="inline-flex items-center gap-1 text-soft">
              {past.length}
              <ChevronDownIcon className="size-4" strokeWidth={3} />
            </span>
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      {upcomingVisible.length > 0 && (
        <div className="border border-ink bg-paper">
          {upcomingVisible.map((e) => (
            <OrdinaryRow key={e.id} e={e} onOpenEvent={onOpenEvent} />
          ))}
        </div>
      )}
      {pastVisible.length > 0 && (
        <section className={upcomingVisible.length > 0 ? "mt-10" : undefined} aria-label="Past events">
          <Eyebrow className="mb-3 block text-soft">Past events · {past.length}</Eyebrow>
          <div className="border border-ink bg-paper">
            {pastVisible.map((e) => (
              <OrdinaryRow key={e.id} e={e} onOpenEvent={onOpenEvent} />
            ))}
          </div>
        </section>
      )}
      {remaining > 0 && (
        <Button variant="secondary" onClick={() => setFeed({ showPast, shownCount: shownCount + pageSize })} className="mt-4 w-full">
          Load older events
          <span className="inline-flex items-center gap-1 text-soft">
            {remaining} more
            <ChevronDownIcon className="size-4" strokeWidth={3} />
          </span>
        </Button>
      )}
      {!showPast && past.length > 0 && (
        <Button variant="secondary" onClick={() => setShowPast(true)} className="mt-4 w-full">
          Show past events
          <span className="inline-flex items-center gap-1 text-soft">
            {past.length}
            <ChevronDownIcon className="size-4" strokeWidth={3} />
          </span>
        </Button>
      )}
    </>
  );
}
