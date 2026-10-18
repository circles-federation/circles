"use client";

import { EyebrowGroup, LinkRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { fmtNumericDate } from "@/lib/format.util";
import { pendingPhotoFor } from "@/lib/members.util";
import type { PendingApplication } from "@/lib/db/applications";
import type { PhotoReview } from "@/lib/db/photo-reviews";

/* A system admin's queue: applications to join, and members' new photos,
   each oldest first and opening its own review page. Both are the same
   check, that a photo shows a real person, so they're one place to look. */
export function ReviewPage({ applications, photos }: { applications: PendingApplication[]; photos: PhotoReview[] }) {
  return (
    <PageContainer size="normal">
      <SectionGroup>
        <Section className="pt-0">
          <EyebrowGroup label={applications.length === 1 ? "1 application" : `${applications.length} applications`}>
            {applications.length === 0 ? (
              <p className="font-serif text-base text-soft">None waiting. New applications appear here once the applicant has confirmed their email.</p>
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
        </Section>
        <Section>
          <EyebrowGroup label={photos.length === 1 ? "1 new photo" : `${photos.length} new photos`}>
            {photos.length === 0 ? (
              <p className="font-serif text-base text-soft">None waiting. A member&apos;s new photo appears here before anyone else sees it.</p>
            ) : (
              <div className="border-t border-ink">
                {photos.map((p) => (
                  <LinkRow
                    key={p.memberId}
                    href={`/admin/photos/${p.memberId}`}
                    // eslint-disable-next-line @next/next/no-img-element -- served only to admins and the member, by version
                    image={<img src={pendingPhotoFor(p.memberId, p.version)} alt="" className="size-14 shrink-0 border border-ink object-cover" />}
                    title={[p.name, p.lastName].filter(Boolean).join(" ")}
                    detail={`${p.neighborhoodName ? `${p.neighborhoodName} · ` : ""}sent ${fmtNumericDate(new Date(p.version).toISOString())}`}
                  />
                ))}
              </div>
            )}
          </EyebrowGroup>
        </Section>
      </SectionGroup>
    </PageContainer>
  );
}
