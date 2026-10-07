"use client";

import clsx from "clsx";
import type { ComponentPropsWithoutRef, ComponentType, SVGProps } from "react";

interface FloatingActionButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // what it does, for screen readers and a hover tip (it shows only an icon)
  label: string;
  // "large" floats over a page; "small" sits in a page's tab row
  size?: "large" | "small";
}

/* The app's floating action button: round (an icon button, one of the
   design's exceptions to square corners), the top bar's frosted-glass white
   with an ink rule and a soft shadow, so it floats over a page as the bar
   does. Where it goes is up to the caller: in the app, a page asks for one
   with useFloatingAction, and AppShell (on a phone, above the bottom nav) or
   SimpleTabs (wider, at the end of the page's tab row) draws it; the welcome
   page, outside the app, places its own. */
export function FloatingActionButton({ icon: Icon, label, size = "large", className, type = "button", ...rest }: FloatingActionButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={clsx(
        "app-chrome flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink bg-paper/80 text-ink backdrop-blur-md transition-transform duration-100 active:scale-95",
        size === "large" ? "size-14 shadow-[0_4px_14px_rgba(10,10,10,0.18)]" : "size-8 shadow-[0_2px_6px_rgba(10,10,10,0.14)]",
        className
      )}
      {...rest}
    >
      <Icon className={size === "large" ? "size-6" : "size-4"} strokeWidth={2} aria-hidden />
    </button>
  );
}
