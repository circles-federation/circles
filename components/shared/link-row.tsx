import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

interface LinkRowProps {
  href: string;
  // a 56px square on the left: a photo or an avatar
  image: ReactNode;
  title: ReactNode;
  detail: ReactNode;
}

/* One row of a list of things to act on, each opening its own page — an
   admin's applications to review, your invitations on Home. Rows sit under
   an ink rule (the caller's `border-t border-ink` wrapper), with hairlines
   between them and an ink rule again under the last, closing the list. */
export function LinkRow({ href, image, title, detail }: LinkRowProps) {
  return (
    <Link href={href} className="flex items-center gap-4 border-b border-faint py-3.5 pr-2 text-ink no-underline last:border-b-ink">
      {image}
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-base font-bold">{title}</div>
        <div className="mt-0.5 truncate font-serif text-sm text-soft">{detail}</div>
      </div>
      <ChevronRightIcon className="size-4 shrink-0" strokeWidth={2.5} />
    </Link>
  );
}
