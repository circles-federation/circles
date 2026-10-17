import clsx from "clsx";
import type { ComponentType, SVGProps } from "react";

interface GhostIconButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  // placement only, e.g. a negative margin lining the icon up with an edge
  className?: string;
}

/* An icon with no fill of its own — the top bar's Back, a modal's close, the
   + at the end of a tab row. A 44px tap area round a 40px circle, which shows
   faintly while pressed so a tap visibly lands. */
export function GhostIconButton({ icon: Icon, label, onClick, className }: GhostIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx("group flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink", className)}
    >
      <span className="flex size-10 items-center justify-center rounded-full transition-[background-color,transform] duration-(--motion-press) group-active:scale-95 group-active:bg-faint">
        <Icon className="size-6" strokeWidth={2} />
      </span>
    </button>
  );
}
