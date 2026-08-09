"use client";

import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "./eyebrow";
import { FAINT, FLAME, INK, PAPER, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* Search input with a compact filter menu attached to its right edge. Supports
   one or more filter groups via the `filters` prop:
     filters = [{ label, options, active, onFilter }, ...]
   Each group renders as a labeled section in a single dropdown. The trigger is
   a small funnel icon that shows a dot when any filter is active. A legacy
   single-filter API (filterLabel/options/active/onFilter) is still accepted and
   normalized into one group. */
export function SearchWithFilter({ query, onQuery, placeholder, filters, filterLabel, options, active, onFilter }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // normalize: accept either `filters` (new) or the legacy single-filter props
  const groups = filters || (options ? [{ label: filterLabel, options, active, onFilter }] : []);
  const activeCount = groups.filter((g) => g.active).length;

  useEffect(() => {
    if (!open) return;
    function onDoc(ev) { if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${INK}` }}>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0, padding: "12px 14px", border: "none",
            fontFamily: serif, fontSize: TYPE.base, background: PAPER, outline: "none",
          }}
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            aria-label="Clear search"
            title="Clear search"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              border: "none", background: PAPER, color: SOFT, padding: "0 12px", fontSize: TYPE.lg, lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
        {groups.length > 0 && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Filter"
            title="Filter"
            style={{
              position: "relative", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              borderLeft: `1px solid ${INK}`, borderTop: "none", borderRight: "none", borderBottom: "none",
              background: activeCount > 0 ? INK : PAPER, color: activeCount > 0 ? PAPER : INK,
              padding: "0 14px", fontSize: TYPE.base,
            }}
          >
            {/* funnel icon */}
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" style={{ display: "block" }}>
              <path d="M1 2h14l-5.5 6.5V14l-3 1V8.5L1 2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            {activeCount > 0 && (
              <span style={{
                position: "absolute", top: 6, right: 6, minWidth: 15, height: 15, padding: "0 3px",
                borderRadius: 8, background: FLAME, color: PAPER, fontFamily: sans, fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
              }}>{activeCount}</span>
            )}
          </button>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 220, maxWidth: "100%", background: PAPER, border: `1px solid ${INK}`, zIndex: 40, boxShadow: "4px 4px 0 rgba(10,10,10,0.08)", maxHeight: 400, overflowY: "auto" }}>
          {groups.map((g, gi) => {
            const all = [null, ...g.options];
            return (
              <div key={g.label || gi} style={{ borderBottom: gi === groups.length - 1 ? "none" : `2px solid ${INK}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px 8px", background: "#f4f4f4", borderBottom: `1px solid ${FAINT}` }}>
                  <Eyebrow style={{ color: SOFT, fontSize: TYPE.micro }}>{g.label}</Eyebrow>
                  {g.active && (
                    <button
                      onClick={() => g.onFilter(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: TYPE.micro, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, color: FLAME, padding: 0 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {all.map((opt, i) => {
                  const selected = g.active === opt;
                  const last = i === all.length - 1;
                  return (
                    <button
                      key={opt || "all"}
                      onClick={() => { g.onFilter(opt); }}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                        fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.04em", fontWeight: 600, cursor: "pointer",
                        padding: "10px 14px", border: "none", borderBottom: last ? "none" : `1px solid ${FAINT}`,
                        background: selected ? INK : PAPER, color: selected ? PAPER : INK,
                      }}
                    >
                      {opt || "All"}
                      {selected && <span style={{ fontFamily: serif, fontSize: TYPE.xs }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
