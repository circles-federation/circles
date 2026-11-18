import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

interface LinkRowProps {
  href: string;
  // on the left: a photo, an avatar, a date tile or an icon
  image: ReactNode;
  title: ReactNode;
  detail: ReactNode;
  // a control of its own at the right end, outside the link, in place of
  // the chevron (Up next's RSVP)
  trailing?: ReactNode;
  // a status at the right, inside the link (Up next's Going), in place of the chevron
  badge?: ReactNode;
  // the whole row inverts while pressed, like a card (Up next): the box it sits in
  // then has no side padding of its own, since the row carries it
  press?: boolean;
}

/* One row of a list of things to act on, each opening its own page — an
   admin's applications to review, what needs you on Home. Rows sit in a box with
   an ink outline (the caller's `border border-ink` wrapper), with ink lines
   between them. */
export function LinkRow({ href, image, title, detail, trailing, badge, press }: LinkRowProps) {
  return (
    <div className={clsx("flex items-center gap-3 border-b border-ink last:border-b-0", press && "ink-press px-4")}>
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-4 py-4 pr-2 text-ink no-underline">
        {image}
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-base font-bold">{title}</div>
          <div className="mt-0.5 truncate font-serif text-sm text-soft">{detail}</div>
        </div>
        {badge}
        {!trailing && !badge && <ChevronRightIcon className="size-4 shrink-0" strokeWidth={2.5} />}
      </Link>
      {trailing}
    </div>
  );
}
