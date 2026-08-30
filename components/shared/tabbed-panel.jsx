import clsx from "clsx";

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name, so a tab's accent bar is a
// named variant (defaulting to "ink"), not a caller-supplied raw color.
const ACCENT_SHADOW = {
  ink: "shadow-[inset_0_3px_0_var(--color-ink)]",
  flame: "shadow-[inset_0_3px_0_var(--color-flame)]",
};

/* Reusable tabbed panel: a row of tabs attached to a bordered content box, so
   it's clear the tabs control what's shown inside. The active tab merges into
   the box (its bottom border drops away) and gets a colored accent bar on top.
   `tabs` = [{ key, label, variant?, count? }], variant one of ACCENT_SHADOW's
   keys. `bodyPad` toggles inner padding (set false when the body is a
   full-width list). */
export function TabbedPanel({ tabs, active, onChange, bodyPad = true, className, children }) {
  return (
    <div className={className}>
      <div className="flex">
        {tabs.map((t, i) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={clsx(
                "relative -mb-px inline-flex flex-1 cursor-pointer items-center justify-center gap-2",
                "border-t border-t-ink border-r border-r-ink py-3.25 px-2",
                "font-sans text-eyebrow font-bold tracking-wide uppercase",
                i === 0 ? "border-l border-l-ink" : "border-l-0",
                on
                  ? clsx("z-2 border-b border-b-transparent bg-paper text-ink", ACCENT_SHADOW[t.variant || "ink"])
                  : "z-1 border-b border-b-ink bg-[#f4f4f4] text-soft",
              )}
            >
              {t.label}
              {t.count != null && <span className="opacity-70">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div className={clsx("relative z-1 border border-ink", bodyPad ? "px-5.5 pt-5.5 pb-6.5" : "p-0")}>
        {children}
      </div>
    </div>
  );
}
