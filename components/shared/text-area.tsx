"use client";

import clsx from "clsx";
import { DISABLED_FIELD } from "./input";
import type { ComponentPropsWithoutRef } from "react";

/* Shared multi-line text field — same bordered, serif-body look as
   Input, plus vertical resize and relaxed line-height for prose. */
export function TextArea({ className, ...rest }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={clsx("w-full resize-y border border-ink bg-paper px-3 py-2.75 font-serif text-base leading-normal outline-none disabled:resize-none", DISABLED_FIELD, className)}
      {...rest}
    />
  );
}
