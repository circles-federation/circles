import clsx from "clsx";
import type { ReactNode } from "react";

export type PageSize = "wide" | "normal" | "compact";

// full literal class strings per key — Tailwind's static scan can't see
// through a template-interpolated class name like `max-w-${n}`. Three
// widths cover every page: wide (270) for dashboards/lists (Home, Circles,
// Events list), normal (220) for detail pages (Event, Circle), compact (170)
// for forms.
const MAX_WIDTH: Record<PageSize, string> = {
  wide: "max-w-270",
  normal: "max-w-220",
  compact: "max-w-170",
};

interface PageContainerProps {
  size: PageSize;
  className?: string;
  children: ReactNode;
}

/* Shared top-level page wrapper: centers content at one of three widths and
   carries the px-6/pt-6/pb-20 rhythm every route page uses, so a spacing fix
   (like matching pt to px-6) happens once here instead of being hand-copied
   across a dozen near-identical containers. Not a fit for the welcome page,
   whose centered login layout doesn't share this shape at all.

   pt-6 is flat, not per-page — Playwright measurements confirmed a 24px gap
   from the top bar everywhere, matching px-6, regardless of whether a page's
   first element is a masthead or a SearchWithFilter.

   pb is a flat pb-20 for the same reason pt no longer varies — Playwright
   showed a page's own bottom padding is invisible in practice on mobile
   anyway (AppShell's own BottomNav-clearance padding dominates whatever a
   page sets here), so there was nothing for a pb-16/pb-20 split to actually
   accomplish. */
export function PageContainer({ size, className, children }: PageContainerProps) {
  return (
    // blurs in as it appears: on navigating to a page, once its content (not
    // the loading state) lands, and on Back to one Next kept, since showing a
    // hidden element again restarts its animation. Not for reduced motion.
    <div className={clsx("mx-auto px-6 pt-6 pb-20 motion-safe:animate-blur-in", MAX_WIDTH[size], className)}>
      {children}
    </div>
  );
}
