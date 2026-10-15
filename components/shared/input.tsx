"use client";

import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

/* How a form field looks when it can't be changed (disabled): a grey wash,
   a faint border and grey text, so it doesn't pass for one that can. iOS
   dims a disabled field's text with opacity and its own text colour, both
   undone here so the grey is the only cue. For hand-built fields too. */
export const DISABLED_FIELD =
  "disabled:cursor-not-allowed disabled:border-faint disabled:bg-wash disabled:text-soft disabled:opacity-100 disabled:[-webkit-text-fill-color:var(--color-soft)]";

/* Shared single-line text field — the bordered, serif-body look already
   established throughout the app's forms. */
export function Input({ className, ...rest }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={clsx("w-full border border-ink bg-paper px-3 py-2.75 font-serif text-base outline-none", DISABLED_FIELD, className)}
      {...rest}
    />
  );
}
