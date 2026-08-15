"use client";

import clsx from "clsx";

/* Shared single-line text field — the bordered, serif-body look already
   established throughout the app's forms (matches the old fieldInput
   style constant in form-fields.jsx exactly). */
export function Input({ className, ...rest }) {
  return (
    <input
      className={clsx("w-full border border-ink bg-paper px-3 py-2.75 font-serif text-base outline-none", className)}
      {...rest}
    />
  );
}
