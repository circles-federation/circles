"use client";

import clsx from "clsx";
import { DateTile } from "./date-tile";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { hostInfo } from "@/lib/data";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { isExclusive } from "@/lib/governance.util";
import { hasRoles, roleShort, shiftCancelled } from "@/lib/roles.util";
import { FLAME, INK, PLUM, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* A single ordinary-event row. Read-only — RSVPing/signing up happens on
   the event's own page; this just shows how many people are going. */
export function OrdinaryRow({ e, onOpenEvent }) {
  const h = hostInfo(e.host);
  const past = isPastEvent(e);
  const exclusive = isExclusive(e);
  const metaColor = past ? SOFT : "#222";
  // slotted events don't use a plain RSVP list — count signups across roles instead
  const count = hasRoles(e) ? e.roles.reduce((sum, r) => sum + roleShort(r), 0) : e.rsvps.length;
  const cancelled = !past && hasRoles(e) && shiftCancelled(e);
  return (
    <div style={{ borderBottom: `1px solid ${INK}`, display: "flex", gap: 18, padding: "20px 22px 20px 16px", alignItems: "flex-start", borderLeft: `4px solid ${exclusive ? PLUM : "transparent"}`, ...(exclusive ? { background: "rgba(106,61,154,0.04)" } : {}) }}>
      <DateTile iso={e.date} accentColor={past ? SOFT : (exclusive ? PLUM : undefined)} />
      <button
        onClick={() => onOpenEvent(e)}
        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>
            {fmtTime(e.start)}–{fmtTime(e.end)}
          </Eyebrow>
          {exclusive && <Eyebrow style={{ color: PLUM, fontSize: TYPE.micro }}>· Members only</Eyebrow>}
        </div>
        <div className={clsx("mt-1.75 mb-1.5 font-sans text-lg min-[720px]:text-xl font-extrabold tracking-[-0.025em] leading-[1.05]", past ? "text-soft" : "text-ink")}>
          {e.title}
        </div>
        <div style={{ fontFamily: serif, fontSize: TYPE.sm, color: metaColor }}>
          Hosted by {h.label} · {e.location}
        </div>
      </button>
      <div style={{ flexShrink: 0, paddingTop: 4, textAlign: "right" }}>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.sm, color: past ? SOFT : INK, whiteSpace: "nowrap" }}>
          {count} {past ? "Went" : "Going"}
        </div>
        {cancelled && (
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: TYPE.micro, letterSpacing: "0.06em", textTransform: "uppercase", color: FLAME, marginTop: 2, whiteSpace: "nowrap" }}>
            ⚠ Cancelled
          </div>
        )}
      </div>
    </div>
  );
}
