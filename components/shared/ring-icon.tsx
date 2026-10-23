import type { SVGProps } from "react";

// a circle as an icon: the chips' ring (every chip names a circle), drawn
// on heroicons' 24-unit grid so it sits with them in a menu
export function RingIcon({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} {...props}>
      <circle cx="12" cy="12" r="8.25" />
    </svg>
  );
}
