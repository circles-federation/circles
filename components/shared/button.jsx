"use client";

import clsx from "clsx";

const PRIMARY_ACCENTS = {
  ink: "btn-invert btn-ink border-ink bg-ink text-paper",
  flame: "btn-invert btn-flame border-flame bg-flame text-paper",
  teal: "btn-invert btn-teal border-teal bg-teal text-paper",
};

const VARIANTS = {
  primary: PRIMARY_ACCENTS,
  secondary: "ink-press border-ink bg-paper text-ink",
  danger: "ink-press border-danger bg-paper text-danger",
};

const SIZES = {
  default: "py-3.25 px-6",
  compact: "py-2.5 px-3.75",
};

/* Shared action button — encapsulates the filled/invert-on-press primary
   style and the outlined secondary/danger style already established
   throughout the app (Save/Cancel pairs, form submit buttons, small
   "+ Add X" utility actions), plus the disabled treatment, so call sites
   stop re-declaring the same inline style object. A leading icon is just
   a child rendered before the label text (e.g. `<Button><PlusIcon .../>
   Add hours</Button>`) — no separate prop needed for that. NOT for
   icon-only controls (row-remove ✕, dismiss ✕, etc.) — this component
   always renders a visible text label; bespoke icon-only buttons stay
   bespoke. */
export function Button({
  variant = "primary",
  accent = "ink",
  size = "default",
  disabled = false,
  className,
  type = "button",
  children,
  ...rest
}) {
  const variantClass = variant === "primary" ? PRIMARY_ACCENTS[accent] : VARIANTS[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap border",
        "font-sans text-xs font-bold uppercase tracking-wide",
        SIZES[size],
        disabled ? "cursor-not-allowed border-faint bg-paper text-soft" : clsx("cursor-pointer", variantClass),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
