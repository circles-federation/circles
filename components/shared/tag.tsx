import clsx from "clsx";
import type { MouseEventHandler, ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  filled?: boolean;
  onClick?: MouseEventHandler<HTMLSpanElement>;
}

export function Tag({ children, filled, onClick }: TagProps) {
  return (
    <span
      onClick={onClick}
      className={clsx(
        "inline-block font-sans text-xs tracking-caps py-1.5 px-3 mr-2 mb-2 uppercase font-semibold border border-ink",
        filled ? "bg-ink text-paper" : "bg-paper text-ink",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
    >
      {children}
    </span>
  );
}
