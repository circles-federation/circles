"use client";

import clsx from "clsx";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { ComponentPropsWithoutRef } from "react";

/* Shared dropdown field — same bordered, serif-body look as Input, plus a
   chevron affordance since a native <select> gives no other visual hint
   it's a dropdown once appearance is reset. */
export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<"select">) {
  return (
    <div className={clsx("relative", className)}>
      <select
        className="w-full cursor-pointer appearance-none border border-ink bg-paper px-3 py-2.75 pr-9 font-serif text-base outline-none"
        {...rest}
      >
        {children}
      </select>
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-soft"
        strokeWidth={2}
      />
    </div>
  );
}
