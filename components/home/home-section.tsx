import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { AttentionDot, Eyebrow } from "@/components/shared";

interface HomeSectionProps {
  label: string;
  // how many there are, after the label: "My tasks · 2"
  count?: number;
  // the Home tab's dot, on the section it's about
  attention?: boolean;
  // where the whole of what's shown here is: "My events ›"
  more?: { label: string; href: string };
  children: ReactNode;
}

/* One of Home's sections: its eyebrow (with a count, and the Home tab's
   attention dot when it's this section that lit it), a link on the right to
   the whole of what it shows, and what's in it. */
export function HomeSection({ label, count, attention, more, children }: HomeSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Eyebrow>{label}</Eyebrow>
          {count !== undefined && <span className="border border-ink bg-paper px-1.5 py-0.5 font-sans text-label leading-none font-bold tabular-nums">{count}</span>}
          {attention && <span className="relative size-2.5"><AttentionDot className="top-0 left-0" /></span>}
        </div>
        {more && (
          <Link href={more.href} className="hit flex shrink-0 items-center gap-0.5 font-sans text-label font-bold tracking-caps text-ink uppercase no-underline">
            {more.label}
            <ChevronRightIcon className="size-4" strokeWidth={2.5} aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
