"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow } from "@/components/shared";
import { GovernanceRow } from "./governance-row";
import { OrdinaryRow } from "./ordinary-row";
import { isPastEvent, parseDay } from "@/lib/format.util";
import { kindOf } from "@/lib/governance.util";

/* A single chronological event feed: upcoming events first (soonest at top),
   then past events (most recent first), so reading downward moves backward
   through time across the present moment. Paginates with "Load more", which
   appends older events. Reused by the Events page and the Home dashboard —
   spacing above the list is the caller's job (e.g. home.page.jsx wraps this
   in an EyebrowGroup), not this component's. */
export function EventFeed({ events, councilProposals, onOpenEvent, pageSize = 12, emptyText = "No events yet." }) {
  const { ordered, upcomingCount } = useMemo(() => {
    const up = [], pa = [];
    events.forEach((e) => (isPastEvent(e) ? pa : up).push(e));
    up.sort((a, b) => parseDay(a.date) - parseDay(b.date)); // soonest first
    pa.sort((a, b) => parseDay(b.date) - parseDay(a.date)); // most recent first
    return { ordered: [...up, ...pa], upcomingCount: up.length };
  }, [events]);

  const [shownCount, setShownCount] = useState(pageSize);
  const visible = ordered.slice(0, shownCount);
  const remaining = ordered.length - visible.length;
  // the "now" seam sits between the last upcoming and first past event — show it
  // only when there are events on both sides and the seam is within view
  const showSeam = upcomingCount > 0 && upcomingCount < ordered.length && upcomingCount <= visible.length;

  if (ordered.length === 0) {
    return <p className="mt-4 font-serif text-base text-soft">{emptyText}</p>;
  }

  return (
    <>
      <div className="border-t border-ink">
        {visible.map((e, i) => (
          <Fragment key={e.id}>
            {showSeam && i === upcomingCount && (
              <div aria-label="Past events below" className="flex items-center gap-3 border-b border-ink px-4 py-3.5">
                <span className="h-px flex-1 bg-faint" />
                <Eyebrow className="text-soft">Past</Eyebrow>
                <span className="h-px flex-1 bg-faint" />
              </div>
            )}
            {kindOf(e).governance
              ? <GovernanceRow e={e} onOpenEvent={onOpenEvent} hasCouncilProposal={(councilProposals || []).some((p) => p.assemblyId === e.id)} />
              : <OrdinaryRow e={e} onOpenEvent={onOpenEvent} />}
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
    </>
  );
}
