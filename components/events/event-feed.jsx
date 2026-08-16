"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { GovernanceRow } from "./governance-row";
import { OrdinaryRow } from "./ordinary-row";
import { isPastEvent, parseDay } from "@/lib/format.util";
import { kindOf } from "@/lib/governance.util";
import { FAINT, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* A single chronological event feed: upcoming events first (soonest at top),
   then past events (most recent first), so reading downward moves backward
   through time across the present moment. Paginates with "Load more", which
   appends older events. Reused by the Events page and the Home dashboard. */
export function EventFeed({ events, councilProposals, onOpenEvent, pageSize = 12, emptyText = "No events yet.", topBorder = false }) {
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
    return (
      <p style={{ fontFamily: serif, fontSize: TYPE.base, color: SOFT, margin: "16px 0 0" }}>{emptyText}</p>
    );
  }

  return (
    <>
      <div className="tab-list" style={{ marginTop: topBorder ? 14 : 0, borderTop: `1px solid ${INK}` }}>
        {visible.map((e, i) => (
          <Fragment key={e.id}>
            {showSeam && i === upcomingCount && (
              <div aria-label="Past events below" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${INK}` }}>
                <span style={{ flex: 1, height: 1, background: FAINT }} />
                <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>Past</Eyebrow>
                <span style={{ flex: 1, height: 1, background: FAINT }} />
              </div>
            )}
            {kindOf(e).governance
              ? <GovernanceRow e={e} onOpenEvent={onOpenEvent} hasCouncilProposal={(councilProposals || []).some((p) => p.assemblyId === e.id)} />
              : <OrdinaryRow e={e} onOpenEvent={onOpenEvent} />}
          </Fragment>
        ))}
      </div>
      {remaining > 0 && (
        <button
          onClick={() => setShownCount((n) => n + pageSize)}
          className="ink-press"
          style={{
            width: "100%", marginTop: 16, cursor: "pointer",
            fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            padding: "14px 8px", border: `1px solid ${INK}`, background: PAPER, color: INK,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          Load older events
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: SOFT }}>
            {remaining} more
            <ChevronDownIcon className="size-3" strokeWidth={3} />
          </span>
        </button>
      )}
    </>
  );
}
