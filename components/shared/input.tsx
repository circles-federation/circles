"use client";

import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";

/* How a form field looks when it can't be changed (disabled): a grey wash,
   a faint border and grey text, so it doesn't pass for one that can. iOS
   dims a disabled field's text with opacity and its own text colour, both
   undone here so the grey is the only cue. For hand-built fields too. */
export const DISABLED_FIELD =
  "disabled:cursor-not-allowed disabled:border disabled:border-dashed disabled:border-faint disabled:bg-paper disabled:text-soft disabled:opacity-100 disabled:[-webkit-text-fill-color:var(--color-soft)]";

// a field: filled light grey, with an ink rule along its bottom while it's
// being typed in (there all along, transparent, so focusing doesn't shift it)
export const FIELD = "border-0 border-b border-soft bg-wash outline-none focus:border-ink focus:shadow-[inset_0_-1px_0_var(--color-ink)]";

// the same look on a row holding a bare <input> or two and controls of its own
// (an aim and its ×, a day and its hours): the row is the field, ruled while
// any input in it has focus, and the inputs inside it are transparent
export const FIELD_ROW = "flex items-stretch border-0 border-b border-soft bg-wash has-[input:focus]:border-ink has-[input:focus]:shadow-[inset_0_-1px_0_var(--color-ink)]";
// such a row that can't be changed, as DISABLED_FIELD looks
export const FIELD_ROW_DISABLED = "flex items-stretch border border-dashed border-faint bg-paper";
// a bare input inside a FIELD_ROW
export const ROW_INPUT = "min-w-0 flex-1 border-0 bg-transparent px-3 py-3 font-serif text-base outline-none disabled:cursor-not-allowed disabled:text-soft disabled:opacity-100 disabled:[-webkit-text-fill-color:var(--color-soft)]";

/* Shared single-line text field — the bordered, serif-body look already
   established throughout the app's forms. */
// a ref, as React 19 passes it, reaches the <input> with the rest
export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return (
    <input
      className={clsx("w-full px-3 py-3 font-serif text-base", FIELD, DISABLED_FIELD, className)}
      {...rest}
    />
  );
}
