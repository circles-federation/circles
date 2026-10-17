"use client";

import clsx from "clsx";
import { DISABLED_FIELD, FIELD } from "./input";
import type { ComponentPropsWithoutRef } from "react";

/* Shared multi-line text field — same bordered, serif-body look as
   Input, plus vertical resize and relaxed line-height for prose. */
export function TextArea({ className, ...rest }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={clsx("w-full resize-y px-3 py-3 font-serif text-base leading-normal disabled:resize-none", FIELD, DISABLED_FIELD, className)}
      {...rest}
    />
  );
}
