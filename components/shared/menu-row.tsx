import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

interface MenuRowProps {
  href: string;
  label: ReactNode;
  // a line under the label, such as what the page it opens is set to
  detail?: ReactNode;
  // a heroicon before the label, saying what the page is about at a glance
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

/* A boxed row that opens a page of its own, like a row in iOS's Settings:
   Home's way into an admin's applications, and each part of Settings. Boxed
   and inverting while pressed, unlike LinkRow's open list rows. */
export function MenuRow({ href, label, detail, icon: Icon }: MenuRowProps) {
  return (
    <Link href={href} className="ink-press flex items-center gap-3.5 border border-ink bg-paper px-4.5 py-4 text-ink no-underline">
      {Icon && <Icon className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-base font-bold">{label}</span>
        {detail && <span className="mt-0.5 block font-serif text-sm text-soft">{detail}</span>}
      </span>
      <ChevronRightIcon className="size-4 shrink-0" strokeWidth={2.5} />
    </Link>
  );
}
