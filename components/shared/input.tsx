"use client";

import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

/* Shared single-line text field — the bordered, serif-body look already
   established throughout the app's forms. */
export function Input({ className, ...rest }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={clsx("w-full border border-ink bg-paper px-3 py-2.75 font-serif text-base outline-none", className)}
      {...rest}
    />
  );
}
