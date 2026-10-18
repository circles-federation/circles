"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow, Label, Modal, PageContainer, Section, SectionGroup, TextArea, useToast } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { approvePhotoAction, declinePhotoAction } from "@/lib/db/actions";
import { APPLICATION_NOTE_MAX } from "@/lib/applications.util";
import { fmtNumericDate } from "@/lib/format.util";
import { pendingPhotoFor, placeholderFor } from "@/lib/members.util";
import type { PhotoReview } from "@/lib/db/photo-reviews";

/* A member's new photo, for a system admin to decide, beside the one it
   would replace: is it a real face, and the same person? Approve is the top
   bar's action; Decline is at the foot, with a note for the member. Each
   asks first, since either one tells them. */
export function PhotoReviewPage({ review: r }: { review: PhotoReview }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { reviewDecided } = useAppState();
  const [confirming, setConfirming] = useState<"approve" | "decline" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const name = [r.name, r.lastName].filter(Boolean).join(" ");

  useTopBarAction({ label: "Approve", icon: CheckIcon, onAction: () => setConfirming("approve"), disabled: busy, variant: "primary" });

  async function decide(approve: boolean) {
    setBusy(true);
    const result = approve ? await approvePhotoAction(r.memberId, r.version) : await declinePhotoAction(r.memberId, r.version, note);
    setBusy(false);
    setConfirming(null);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't save that decision", message: result.error });
      return;
    }
    reviewDecided();
    showToast({ tone: "success", title: approve ? "Photo approved" : "Photo declined", message: `We'll let ${r.name} know.` });
    router.push("/admin/review");
    router.refresh();
  }

  return (
    <PageContainer size="normal">
      <div className="border-t-[3px] border-t-ink border-b border-b-ink pt-5 pb-6">
        <h1 className="font-sans text-title leading-[0.92] font-extrabold tracking-[-0.035em]">{name}</h1>
        <p className="mt-3 font-serif text-base text-soft">
          {r.neighborhoodName ? `${r.neighborhoodName} · ` : ""}sent {fmtNumericDate(new Date(r.version).toISOString())}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 min-[480px]:max-w-120">
          <figure>
            {/* what their neighbors see now: their photo, or until they've
                uploaded one, the placeholder every member starts with */}
            <Eyebrow className="text-soft">{r.currentVersion ? "Now" : "Now · placeholder"}</Eyebrow>
            {/* eslint-disable-next-line @next/next/no-img-element -- served to an admin only while a new one waits */}
            <img
              src={r.currentVersion ? `/api/members/${r.memberId}/photo?review&v=${r.currentVersion}` : placeholderFor(r.memberId)}
              alt={r.currentVersion ? `${name}'s current photo` : "The placeholder shown until they upload a photo"}
              className="mt-2 aspect-square w-full border border-ink object-cover"
            />
          </figure>
          <figure>
            <Eyebrow>New</Eyebrow>
            {/* eslint-disable-next-line @next/next/no-img-element -- served only to admins and the member, by version */}
            <img src={pendingPhotoFor(r.memberId, r.version)} alt={`${name}'s new photo`} className="mt-2 aspect-square w-full border-2 border-ink object-cover" />
          </figure>
        </div>
      </div>

      <SectionGroup>
        <Section>
          <p className="mb-4 font-serif text-base leading-normal text-soft">
            Approve if it clearly shows a real person&apos;s face{r.currentVersion ? ", the same person as now" : ""}.{!r.currentVersion && " They haven't uploaded a photo before, so neighbors see a placeholder until one's approved."} Either way, {r.name} is told; declined, it&apos;s deleted and they keep the photo they have.
          </p>
          <Button variant="danger" onClick={() => setConfirming("decline")} disabled={busy} className="w-full min-[480px]:w-auto">
            Decline
          </Button>
        </Section>
      </SectionGroup>

      {confirming === "approve" && (
        <Modal onClose={() => !busy && setConfirming(null)} className="max-w-105" title="Approve this photo?">
          <div className="px-5 py-5">
            <p className="font-serif text-base leading-normal text-body">It replaces {r.name}&apos;s current photo for everyone who can see it.</p>
            <Button onClick={() => decide(true)} disabled={busy} className="mt-5 w-full">
              {busy ? "Approving…" : "Approve"}
            </Button>
          </div>
        </Modal>
      )}

      {confirming === "decline" && (
        <Modal onClose={() => !busy && setConfirming(null)} className="max-w-105" title="Decline this photo?">
          <div className="px-5 py-5">
            <Label htmlFor="note">Note to {r.name} (optional)</Label>
            <TextArea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={APPLICATION_NOTE_MAX} placeholder="For example, what kind of photo would work" />
            <p className="mt-1.5 font-serif text-sm text-soft">Included in the email and notification telling them.</p>
            <Button variant="danger" onClick={() => decide(false)} disabled={busy} className="mt-5 w-full">
              {busy ? "Declining…" : "Decline"}
            </Button>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
