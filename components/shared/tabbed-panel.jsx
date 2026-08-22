import { INK, PAPER, SOFT, TYPE, sans } from "@/lib/theme";

/* Reusable tabbed panel: a row of tabs attached to a bordered content box, so
   it's clear the tabs control what's shown inside. The active tab merges into
   the box (its bottom border drops away) and gets a colored accent bar on top.
   `tabs` = [{ key, label, accent?, count? }]. `bodyPad` toggles inner padding
   (set false when the body is a full-width list). */
export function TabbedPanel({ tabs, active, onChange, bodyPad = true, marginTop = 24, children }) {
  return (
    <div style={{ marginTop }}>
      <div style={{ display: "flex" }}>
        {tabs.map((t, i) => {
          const on = t.key === active;
          const accent = t.accent || INK;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              style={{
                flex: 1, fontFamily: sans, fontSize: TYPE.eyebrow, letterSpacing: "0.1em", textTransform: "uppercase",
                fontWeight: 700, padding: "13px 8px", cursor: "pointer",
                borderTop: `1px solid ${INK}`,
                borderLeft: i === 0 ? `1px solid ${INK}` : "none",
                borderRight: `1px solid ${INK}`,
                borderBottom: on ? "1px solid transparent" : `1px solid ${INK}`,
                boxShadow: on ? `inset 0 3px 0 ${accent}` : "none",
                background: on ? PAPER : "#f4f4f4",
                color: on ? INK : SOFT,
                marginBottom: -1, position: "relative", zIndex: on ? 2 : 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {t.label}
              {t.count != null && <span style={{ opacity: 0.7 }}>{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ border: `1px solid ${INK}`, padding: bodyPad ? "22px 22px 26px" : 0, position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
