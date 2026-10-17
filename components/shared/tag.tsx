import clsx from "clsx";
import type { MouseEventHandler, ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  filled?: boolean;
  onClick?: MouseEventHandler<HTMLSpanElement>;
}

/* A thing someone offers, needs, knows or likes: information, so in sentence
   case, and filled grey with no outline, since an outline here means
   something to tap. */
export function Tag({ children, filled, onClick }: TagProps) {
  return (
    <span
      onClick={onClick}
      className={clsx(
        "mr-2 mb-2 inline-block px-3 py-1.5 font-sans text-sm font-semibold",
        filled ? "bg-ink text-paper" : "bg-wash text-ink",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
    >
      {children}
    </span>
  );
}
