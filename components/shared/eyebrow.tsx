import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Eyebrow({ children, style, className }: EyebrowProps) {
  // enforce a legible minimum: ignore any fontSize override below 11px
  const merged: CSSProperties = { ...style };
  if (typeof merged.fontSize === "number" && merged.fontSize < 11) delete merged.fontSize;
  return (
    <span
      className={clsx("font-sans text-eyebrow tracking-eyebrow uppercase font-bold", className)}
      style={merged}
    >
      {children}
    </span>
  );
}
