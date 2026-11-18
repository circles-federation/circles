"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Avatar, Button, ConfirmModal, Eyebrow, PageContainer, Section, SectionGroup, useToast } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { CIRCLE_TYPE_LABEL } from "@/lib/circles.util";
import { fmtNumericDate } from "@/lib/format.util";
import { useMemberById } from "@/lib/hooks";
import type { Circle, CircleInvitation, Member } from "@/lib/types";

interface InvitationPageProps {
  invitation: CircleInvitation;
  // undefined for a group the viewer isn't in yet, which they can't see — the
  // invitation carries its name and tagline instead
  circle: Circle | undefined;
  onOpenCircle: (c: Circle) => void;
  onOpenMember: (m: Member) => void;
  // after accepting: to the circle just joined
  onAccepted: (circleId: string) => void;
  // after declining or deleting it
  onGone: () => void;
}

/* One invitation to a circle. For the person invited, Accept is the top bar's
   action and Decline is at the foot; for a member of the circle, it's who was
   invited and by whom, with Delete at the foot. Declining and deleting each
   ask first. */
export function InvitationPage({ invitation: inv, circle, onOpenCircle, onOpenMember, onAccepted, onGone }: InvitationPageProps) {
  const { profile, acceptInvitation, deleteInvitation } = useAppState();
  const { showToast } = useToast();
  const memberById = useMemberById();
  const invitee = memberById(inv.memberId);
  const inviter = inv.invitedBy !== undefined ? memberById(inv.invitedBy) : undefined;
  const mine = inv.memberId === profile.id;
  // the other person in it: who invited you, or who was invited
  const other = mine ? inviter : invitee;
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function accept() {
    setBusy(true);
    const result = await acceptInvitation(inv.id);
    setBusy(false);
    if (result.ok) onAccepted(result.circleId);
    else showToast({ tone: "error", title: "Couldn't accept the invitation", message: result.error });
  }

  async function remove() {
    setBusy(true);
    const result = await deleteInvitation(inv.id, mine);
    setBusy(false);
    setConfirming(false);
    if (result.ok) onGone();
    else showToast({ tone: "error", title: mine ? "Couldn't decline the invitation" : "Couldn't delete the invitation", message: result.error });
  }

  // only the person invited has anything to accept
  useTopBarAction(mine ? { label: busy ? "Joining" : "Accept", icon: CheckIcon, onAction: () => void accept(), disabled: busy, variant: "primary" } : null);

  const sent = fmtNumericDate(inv.createdAt);
  return (
    <PageContainer size="normal">
      <div className="border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-6">
        <Eyebrow className="text-soft">Invitation to join</Eyebrow>
        {circle ? (
          <button type="button" onClick={() => onOpenCircle(circle)} className="mt-3 block cursor-pointer border-0 bg-transparent p-0 text-left">
            <h1 className="font-sans text-title leading-[0.92] font-extrabold tracking-display underline decoration-2 underline-offset-4">{inv.circleName}</h1>
          </button>
        ) : (
          <h1 className="mt-3 font-sans text-title leading-[0.92] font-extrabold tracking-display">{inv.circleName}</h1>
        )}
        {inv.circleTagline && <p className="mt-4 font-serif text-xl text-body italic">{inv.circleTagline}</p>}
      </div>

      <SectionGroup>
        <Section>
          <div className="flex items-center gap-4">
            {other && (
              <button type="button" onClick={() => onOpenMember(other)} aria-label={other.name} className="shrink-0 cursor-pointer border-0 bg-transparent p-0">
                <Avatar member={other} size={56} />
              </button>
            )}
            <p className="font-serif text-lg leading-normal">
              {mine
                ? <>{inviter ? <strong className="font-sans">{inviter.name}</strong> : "A member"} invited you to join this {circle ? CIRCLE_TYPE_LABEL[circle.type].toLowerCase() : "group"} on {sent}.</>
                : <><strong className="font-sans">{invitee?.name ?? "Someone"}</strong> was invited{inviter ? <> by {inviter.id === profile.id ? "you" : inviter.name}</> : null} on {sent}, and hasn&apos;t accepted yet.</>}
            </p>
          </div>
          {mine && (
            <p className="mt-4 font-serif text-base leading-normal text-soft">
              Accepting makes you a member: you&apos;ll see its bulletin and events, and appear in its members.
            </p>
          )}
        </Section>
        <Section>
          <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy} className="w-full min-[480px]:w-auto">
            {mine ? "Decline" : "Delete invitation"}
          </Button>
        </Section>
      </SectionGroup>

      {confirming && (
        <ConfirmModal
          title={mine ? "Decline this invitation?" : "Delete this invitation?"}
          message={mine
            ? `You won't join ${inv.circleName}. A member can invite you again later.`
            : `${invitee?.name ?? "They"} won't be able to join ${inv.circleName} from it. You can invite them again later.`}
          confirmLabel={mine ? "Decline" : "Delete"}
          cancelLabel="Keep it"
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </PageContainer>
  );
}
