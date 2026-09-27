"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Button, EyebrowGroup, Label, Modal, PageContainer, Section, SectionGroup, TextArea, useToast } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { approveApplicationAction, declineApplicationAction } from "@/lib/db/actions";
import { APPLICATION_NOTE_MAX } from "@/lib/applications.util";
import { fmtNumericDate } from "@/lib/format.util";
import type { PendingApplication } from "@/lib/db/applications";

/* One application, for a system admin to decide: is the photo a real face,
   and is the address in the neighborhood? Approve is the top bar's action;
   Decline is at the foot, with a note for the applicant. Each asks first,
   since either one emails them. */
export function ApplicationReviewPage({ application: a }: { application: PendingApplication }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { applicationDecided } = useAppState();
  const [confirming, setConfirming] = useState<"approve" | "decline" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const name = `${a.firstName} ${a.lastName}`;

  useTopBarAction({ label: "Approve", icon: CheckIcon, onAction: () => setConfirming("approve"), disabled: busy, variant: "primary" });

  async function decide(approve: boolean) {
    setBusy(true);
    const result = approve ? await approveApplicationAction(a.id) : await declineApplicationAction(a.id, note);
    setBusy(false);
    setConfirming(null);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't save that decision", message: result.error });
      return;
    }
    applicationDecided();
    showToast({
      tone: "success",
      title: approve ? `${a.firstName} is a member` : "Application declined",
      message: result.value.emailed
        ? `We've emailed ${a.email} to let them know.`
        : `But we couldn't email ${a.email} — let them know yourself.`,
    });
    router.push("/admin/applications");
    router.refresh();
  }

  return (
    <PageContainer size="normal">
      <div className="flex flex-col gap-5 border-t-[3px] border-t-ink border-b border-b-ink pt-4.5 pb-5.5 min-[480px]:flex-row min-[480px]:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- served per admin by /api/applications/[id]/photo, never cached */}
        <img src={`/api/applications/${a.id}/photo`} alt={`Photo of ${name}`} className="size-48 shrink-0 border border-ink object-cover" />
        <div className="min-w-0">
          <h1 className="font-sans text-title leading-[0.92] font-extrabold tracking-[-0.035em]">{name}</h1>
          <p className="mt-3 font-serif text-base text-soft">Applied {fmtNumericDate(a.submittedAt)}</p>
        </div>
      </div>

      <SectionGroup>
        <Section className="flex flex-col gap-5.5">
          <EyebrowGroup label="Neighborhood">
            <p className="font-sans text-lg font-bold">{a.neighborhoodName}</p>
          </EyebrowGroup>
          <EyebrowGroup label="Home address">
            <p className="font-serif text-lg">{a.address}</p>
          </EyebrowGroup>
          <EyebrowGroup label="Email">
            <p className="font-serif text-lg break-all">{a.email}</p>
          </EyebrowGroup>
        </Section>
        <Section>
          <p className="mb-4 font-serif text-base leading-normal text-soft">
            Approve if the photo clearly shows a real person&apos;s face and the address is in {a.neighborhoodName}. Either way, they&apos;re emailed, and the address and photo are no longer kept with the application.
          </p>
          <Button variant="danger" onClick={() => setConfirming("decline")} disabled={busy} className="w-full min-[480px]:w-auto">
            Decline
          </Button>
        </Section>
      </SectionGroup>

      {confirming === "approve" && (
        <Modal onClose={() => !busy && setConfirming(null)} className="max-w-105" title={`Approve ${a.firstName}?`}>
          <div className="px-4.5 py-5">
            <p className="font-serif text-base leading-normal text-[#222]">
              {name} becomes a member of {a.neighborhoodName}, with this photo, and is emailed to sign in.
            </p>
            <Button onClick={() => decide(true)} disabled={busy} className="mt-5 w-full">
              {busy ? "Approving…" : "Approve"}
            </Button>
          </div>
        </Modal>
      )}

      {confirming === "decline" && (
        <Modal onClose={() => !busy && setConfirming(null)} className="max-w-105" title={`Decline ${a.firstName}?`}>
          <div className="px-4.5 py-5">
            <Label htmlFor="note">Note to {a.firstName} (optional)</Label>
            <TextArea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={APPLICATION_NOTE_MAX} placeholder="For example, what would let you approve it" />
            <p className="mt-1.5 font-serif text-sm text-soft">Included in the email telling them it was declined.</p>
            <Button variant="danger" onClick={() => decide(false)} disabled={busy} className="mt-5 w-full">
              {busy ? "Declining…" : "Decline"}
            </Button>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
