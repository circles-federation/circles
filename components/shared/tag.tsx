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
        "inline-block font-sans text-xs tracking-[0.04em] py-1.5 px-2.75 mr-1.75 mb-1.75 uppercase font-semibold border border-ink",
        filled ? "bg-ink text-paper" : "bg-paper text-ink",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
    >
      {children}
    </span>
  );
}
