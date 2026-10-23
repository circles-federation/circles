import type { ReactNode } from "react";
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
}

/* One row of a list of things to act on, each opening its own page — an
   admin's applications to review, what needs you on Home. Rows sit under
   an ink rule (the caller's `border-t border-ink` wrapper), with hairlines
   between them and an ink rule again under the last, closing the list. */
export function LinkRow({ href, image, title, detail, trailing }: LinkRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-faint last:border-b-ink">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-4 py-4 pr-2 text-ink no-underline">
        {image}
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-base font-bold">{title}</div>
          <div className="mt-0.5 truncate font-serif text-sm text-soft">{detail}</div>
        </div>
        {!trailing && <ChevronRightIcon className="size-4 shrink-0" strokeWidth={2.5} />}
      </Link>
      {trailing}
    </div>
  );
}
