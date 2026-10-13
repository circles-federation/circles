"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow } from "@/components/shared";
import { OrdinaryRow } from "./ordinary-row";
import { hasEnded, parseDay } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { useClock } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface EventFeedProps {
  events: Event[];
  onOpenEvent: (e: Event) => void;
  pageSize?: number;
  emptyText?: string;
}

/* A single chronological event feed: upcoming events first (soonest at top).
   Past events are hidden by default (wherever this is reused — the Events
   page and the Home dashboard) and only join the list, oldest last, once
   revealed via the link below. Paginates with "Load more", which appends
   older events. Spacing above the list is the caller's job (e.g.
   home.page.jsx wraps this in an EyebrowGroup), not this component's. */
export function EventFeed({ events, onOpenEvent, pageSize = 12, emptyText = "No events yet." }: EventFeedProps) {
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

  const [showPast, setShowPast] = useState(false);
  const ordered = showPast ? [...upcoming, ...past] : upcoming;

  const [shownCount, setShownCount] = useState(pageSize);
  const visible = ordered.slice(0, shownCount);
  const remaining = ordered.length - visible.length;
  // the "now" seam sits between the last upcoming and first past event — show it
  // only once past events are revealed and there are events on both sides
  const showSeam = showPast && upcoming.length > 0 && upcoming.length < ordered.length && upcoming.length <= visible.length;

  if (ordered.length === 0) {
    return (
      <>
        <p className="mt-4 font-serif text-base text-soft">{!showPast && past.length > 0 ? "No upcoming events." : emptyText}</p>
        {!showPast && past.length > 0 && (
          <Button variant="secondary" onClick={() => setShowPast(true)} className="mt-3 w-full">
            Show past events
            <span className="inline-flex items-center gap-1 text-soft">
              {past.length}
              <ChevronDownIcon className="size-3" strokeWidth={3} />
            </span>
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <div className="border-t border-ink">
        {visible.map((e, i) => (
          <Fragment key={e.id}>
            {showSeam && i === upcoming.length && (
              <div aria-label="Past events below" className="flex items-center gap-3 border-b border-ink px-4 py-3.5">
                <span className="h-px flex-1 bg-faint" />
                <Eyebrow className="text-soft">Past</Eyebrow>
                <span className="h-px flex-1 bg-faint" />
              </div>
            )}
            <OrdinaryRow e={e} onOpenEvent={onOpenEvent} />
          </Fragment>
        ))}
      </div>
      {remaining > 0 && (
        <Button variant="secondary" onClick={() => setShownCount((n) => n + pageSize)} className="mt-4 w-full">
          Load older events
          <span className="inline-flex items-center gap-1 text-soft">
            {remaining} more
            <ChevronDownIcon className="size-3" strokeWidth={3} />
          </span>
        </Button>
      )}
      {!showPast && past.length > 0 && (
        <Button variant="secondary" onClick={() => setShowPast(true)} className="mt-4 w-full">
          Show past events
          <span className="inline-flex items-center gap-1 text-soft">
            {past.length}
            <ChevronDownIcon className="size-3" strokeWidth={3} />
          </span>
        </Button>
      )}
    </>
  );
}
