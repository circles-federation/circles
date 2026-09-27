"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { EyebrowGroup, PageContainer } from "@/components/shared";
import { fmtNumericDate } from "@/lib/format.util";
import type { PendingApplication } from "@/lib/db/applications";

/* A system admin's queue: every application waiting for review, oldest
   first, each opening its review page. */
export function ApplicationsPage({ applications }: { applications: PendingApplication[] }) {
  return (
    <PageContainer size="normal">
      <EyebrowGroup label={applications.length === 1 ? "1 waiting for review" : `${applications.length} waiting for review`}>
        {applications.length === 0 ? (
          <p className="font-serif text-base text-soft">Nothing to review. New applications appear here once the applicant has confirmed their email.</p>
        ) : (
          <div className="border-t border-ink">
            {applications.map((a) => (
              <Link
                key={a.id}
                href={`/admin/applications/${a.id}`}
                className="ink-press flex items-center gap-4 border-b border-faint bg-paper px-1 py-3.5 text-ink no-underline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served per admin by /api/applications/[id]/photo, never cached */}
                <img src={`/api/applications/${a.id}/photo`} alt="" className="size-14 shrink-0 border border-ink object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-sans text-base font-bold">{a.firstName} {a.lastName}</div>
                  <div className="mt-0.5 truncate font-serif text-sm text-soft">{a.neighborhoodName} · applied {fmtNumericDate(a.submittedAt)}</div>
                </div>
                <ChevronRightIcon className="size-4 shrink-0" strokeWidth={2.5} />
              </Link>
            ))}
          </div>
        )}
      </EyebrowGroup>
    </PageContainer>
  );
}
