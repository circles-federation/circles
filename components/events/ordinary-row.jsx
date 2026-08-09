"use client";

import { DateTile } from "./date-tile";
import { RsvpButton } from "./rsvp-button";
import { Eyebrow } from "@/components/chrome/eyebrow";
import { CURRENT_USER_ID, hostInfo, memberById } from "@/lib/data";
import { isPastEvent, fmtTime } from "@/lib/format.util";
import { isExclusive, isHostOrgMember } from "@/lib/governance.util";
import { useIsMobile } from "@/lib/hooks";
import { hasRoles, shiftCancelled } from "@/lib/roles.util";
import { FAINT, INK, PAPER, PLUM, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* A single ordinary-event row with RSVP control. */
export function OrdinaryRow({ e, rsvpState, toggleRsvp, onOpenEvent }) {
  const isMobile = useIsMobile();
  const h = hostInfo(e.host);
  const going = rsvpState[e.id];
  const count = e.rsvps.length;
  const past = isPastEvent(e);
  const exclusive = isExclusive(e);
  const isHostMember = isHostOrgMember(e, memberById(CURRENT_USER_ID));
  const titleColor = past ? SOFT : INK;
  const metaColor = past ? SOFT : "#222";
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
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.xl, letterSpacing: "-0.025em", lineHeight: 1.05, margin: "7px 0 6px", color: titleColor }}>
          {e.title}
        </div>
        <div style={{ fontFamily: serif, fontSize: TYPE.sm, color: metaColor }}>
          Hosted by {h.label} · {e.location}
        </div>
      </button>
      {!isMobile && (
      <div style={{ flexShrink: 0, paddingTop: 4 }}>
        {hasRoles(e) ? (
          (past || shiftCancelled(e)) ? (
            <button
              disabled
              title={past ? "This event has already happened" : "Cancelled — a required slot wasn't filled in time"}
              style={{
                fontFamily: sans, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                padding: "9px 13px", whiteSpace: "nowrap", cursor: "not-allowed",
                border: `1px solid ${FAINT}`, background: PAPER, color: SOFT,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {past ? "Ended" : "⚠ Cancelled"}
            </button>
          ) : (
            <button
              onClick={() => onOpenEvent(e)}
              style={{
                fontFamily: sans, fontSize: TYPE.label, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                cursor: "pointer", padding: "9px 13px", whiteSpace: "nowrap",
                border: `1px solid ${INK}`, background: PAPER, color: INK,
              }}
            >
              Sign up →
            </button>
          )
        ) : (
          <RsvpButton going={going} count={count} onToggle={() => toggleRsvp(e.id)} disabled={past || (exclusive && !isHostMember)} reason={past ? "past" : ((exclusive && !isHostMember) ? "membersOnly" : undefined)} />
        )}
      </div>
      )}
    </div>
  );
}
