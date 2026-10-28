import clsx from "clsx";
import type { ComponentType, SVGProps } from "react";

// the right-hand slot for an icon button: its 44px tap area, with the 40px
// circle inside so the bar is no taller; -mr-0.5 lines the circle's edge up
// with the page's padding. The same on every screen size, in the top bar and
// a dialog's header alike.
export const ICON_BUTTON_SLOT = "group -mr-0.5 flex size-11 shrink-0 items-center justify-center";

// primary is the page's main job, in blue (Manage circle's Save); secondary
// is the rest, in ink (Create Event, Manage circle, Edit event). A press
// shrinks it a touch, and darkens the blue (ink has no darker to go).
const ICON_BUTTON_FILL = {
  primary: "bg-action text-paper group-active:brightness-90",
  // a Save that proposes, for its circle's consent: the governance orange
  propose: "bg-flame text-paper group-active:brightness-90",
  secondary: "bg-chrome text-on-chrome",
};

/* The circle of an icon button, for ICON_BUTTON_SLOT's button or link to put
   round it. Disabled (a button that has nothing to do yet), it's only a faint
   outline round a grey icon. */
export function IconButtonCircle({ icon: Icon, variant }: { icon: ComponentType<SVGProps<SVGSVGElement>>; variant: keyof typeof ICON_BUTTON_FILL }) {
  return (
    <span
      className={clsx(
        "flex size-10 items-center justify-center rounded-full shadow-float transition-[filter,transform,background-color] duration-(--motion-press) group-active:scale-95",
        ICON_BUTTON_FILL[variant],
        "group-disabled:border group-disabled:border-faint group-disabled:bg-transparent group-disabled:text-soft group-disabled:shadow-none group-disabled:group-active:scale-100 group-disabled:group-active:brightness-100",
      )}
    >
      <Icon className="size-5" strokeWidth={2.5} />
    </span>
  );
}
