"use client";

import clsx from "clsx";
import type { ComponentPropsWithoutRef, ComponentType, SVGProps } from "react";

interface FloatingActionButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // what it does, for screen readers and a hover tip (it shows only an icon)
  label: string;
}

/* The app's floating action button: round (an icon button, one of the
   design's exceptions to square corners), the top bar's frosted-glass white
   with an ink rule and a soft shadow, so it floats over a page as the bar
   does, placed by its caller: the welcome page's Demo accounts. Inside the
   app, what a page offers is in the top bar's menu instead (TopBarMenu). */
export function FloatingActionButton({ icon: Icon, label, className, type = "button", ...rest }: FloatingActionButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={clsx(
        "app-chrome flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink bg-paper/80 text-ink backdrop-blur-md transition-transform duration-(--motion-press) active:scale-95",
        "size-14 shadow-float",
        className
      )}
      {...rest}
    >
      <Icon className="size-6" strokeWidth={2} aria-hidden />
    </button>
  );
}
