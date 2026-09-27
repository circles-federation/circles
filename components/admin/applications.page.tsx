"use client";

import { EyebrowGroup, LinkRow, PageContainer } from "@/components/shared";
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
              <LinkRow
                key={a.id}
                href={`/admin/applications/${a.id}`}
                // eslint-disable-next-line @next/next/no-img-element -- served per admin by /api/applications/[id]/photo, never cached
                image={<img src={`/api/applications/${a.id}/photo`} alt="" className="size-14 shrink-0 border border-ink object-cover" />}
                title={`${a.firstName} ${a.lastName}`}
                detail={`${a.neighborhoodName} · applied ${fmtNumericDate(a.submittedAt)}`}
              />
            ))}
          </div>
        )}
      </EyebrowGroup>
    </PageContainer>
  );
}
