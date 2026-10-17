import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Eyebrow } from "@/components/shared";
import { BETA_AGREEMENT_VERSION } from "@/lib/applications.util";

// in UTC, so the date can't shift a day with the server's timezone
const updated = new Date(`${BETA_AGREEMENT_VERSION}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/* /terms and /privacy: public, for anyone who's agreed to them (or is about
   to) and wants to read them again. Laid out like the apply page, since
   neither sits under the signed-in app's top bar. */
export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-paper px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <Link href="/" className="-ml-1 inline-flex items-center gap-1.5 font-sans text-xs font-bold tracking-caps text-ink uppercase no-underline">
          <ArrowLeftIcon className="size-4" strokeWidth={2.5} />
          Circles
        </Link>
        <div className="mt-6 border-t-[3px] border-t-ink pt-5">
          <Eyebrow className="text-soft">Circles beta · Updated {updated}</Eyebrow>
          <h1 className="mt-3 mb-5 font-sans text-title font-extrabold tracking-[-0.04em] leading-[0.95]">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
