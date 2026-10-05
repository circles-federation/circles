"use client";

import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

type ButtonAccent = "ink" | "flame" | "teal";
type ButtonVariant = "primary" | "secondary" | "danger";
// "inline" is short enough (30px) to sit beside a section's eyebrow label
// without making that header row taller than the label itself
type ButtonSize = "default" | "compact" | "inline";

const PRIMARY_ACCENTS: Record<ButtonAccent, string> = {
  ink: "btn-invert btn-ink border-ink bg-ink text-paper",
  flame: "btn-invert btn-flame border-flame bg-flame text-paper",
  teal: "btn-invert btn-teal border-teal bg-teal text-paper",
};

const NON_PRIMARY_VARIANTS: Record<Exclude<ButtonVariant, "primary">, string> = {
  secondary: "ink-press border-ink bg-paper text-ink",
  danger: "danger-press border-danger bg-paper text-danger",
};

const SIZES: Record<ButtonSize, string> = {
  default: "py-3.25 px-6",
  compact: "py-2.5 px-3.75",
  inline: "py-1.5 px-3",
};

interface ButtonStyle {
  variant?: ButtonVariant;
  accent?: ButtonAccent;
  size?: ButtonSize;
}

interface ButtonProps extends ComponentPropsWithoutRef<"button">, ButtonStyle {}

function buttonClass({ variant = "primary", accent = "ink", size = "default" }: ButtonStyle, disabled: boolean, className?: string): string {
  const variantClass = variant === "primary" ? PRIMARY_ACCENTS[accent] : NON_PRIMARY_VARIANTS[variant];
  return clsx(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap border",
    "font-sans text-xs font-bold uppercase tracking-wide",
    SIZES[size],
    disabled ? "cursor-not-allowed border-faint bg-paper text-soft" : clsx("cursor-pointer", variantClass),
    className,
  );
}

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
export function Button({ variant, accent, size, disabled = false, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled} className={buttonClass({ variant, accent, size }, disabled, className)} {...rest}>
      {children}
    </button>
  );
}

// Button's look on a link, for an action that opens somewhere (an online
// event's Join meeting) rather than running something on the page
export function ButtonLink({ variant, accent, size, className, children, ...rest }: ComponentPropsWithoutRef<"a"> & ButtonStyle) {
  return (
    <a className={buttonClass({ variant, accent, size }, false, clsx("no-underline", className))} {...rest}>
      {children}
    </a>
  );
}
