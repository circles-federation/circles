"use client";

import { useState } from "react";
import { ArrowRightStartOnRectangleIcon, BookOpenIcon, IdentificationIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Button, ConfirmModal, MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { circleHasRoles } from "@/lib/circle-roles.util";
import { circleHasWiki } from "@/lib/circles.util";
import type { Circle, CircleProposal } from "@/lib/types";
import { ProposalBanner } from "./proposal-banner";

interface ManageCirclePageProps {
  circle: Circle;
  memberId: number;
  // a change open for consent, which holds Details and Roles until it's decided
  openProposal?: CircleProposal;
  // leave the circle (the route goes on from it once it's done)
  onLeave: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

// what Details covers, under its row
function detailsSummary(c: Circle): string {
  const parts = ["Name", "tagline", ...(c.type !== "neighborhood" && c.type !== "group" ? ["type"] : []), ...(c.parentId !== null ? ["parent"] : [])];
  const list = `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return c.type === "circle" ? `${parts.join(", ")}, domain and aims` : list;
}

// under Details and Roles while a change to the circle is open for consent
const LOCKED = "Locked while a proposal is open";

// how many of its roles are held, under its row
function rolesSummary(c: Circle): string {
  const roles = c.roles ?? [];
  const held = roles.filter((r) => r.memberId !== null).length;
  return `${held} of ${roles.length} held`;
}

/* Manage circle, reached from a circle page's cog: a menu like Settings,
   each row opening a page of its own — Details (name, type and the rest
   that its members decide by consent), Roles (also by consent), and Wiki
   (what its page's Wiki tab shows, edited freely) — with leaving the
   circle at the foot. */
export function ManageCirclePage({ circle: o, memberId, openProposal, onLeave }: ManageCirclePageProps) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  // a neighborhood, a group and the city have no roles; a group has no wiki
  const showRoles = circleHasRoles(o);
  const showWiki = circleHasWiki(o);
  const base = `/circles/${o.id}/manage`;

  // what leaving means for them: what they lose, the roles they'd leave
  // empty, and, for the last member, that it's archived
  const myRoles = (o.roles ?? []).filter((r) => r.memberId === memberId).map((r) => r.label);
  const leaveMessage = [
    "You'll no longer see its bulletin or the events shown only to its members.",
    myRoles.length > 0 &&
      `You're its ${myRoles.length > 1 ? `${myRoles.slice(0, -1).join(", ")} and ${myRoles[myRoles.length - 1]}` : myRoles[0]}; ${myRoles.length > 1 ? "those roles" : "that role"} will be left empty.`,
    o.members.length <= 1 && "You're its last member, so it will be archived and hidden from everyone.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Manage circle) is the page's only heading */}
        <Section className="pt-0">
          {/* holding Details and Roles until it's decided */}
          {openProposal && <ProposalBanner proposal={openProposal} memberId={memberId} className="mb-5" />}
          <div className="flex flex-col gap-3">
            <MenuRow href={`${base}/details`} icon={IdentificationIcon} label="Details" detail={openProposal ? LOCKED : detailsSummary(o)} />
            {showRoles && <MenuRow href={`${base}/roles`} icon={UserGroupIcon} label="Roles" detail={openProposal ? LOCKED : rolesSummary(o)} />}
            {showWiki && <MenuRow href={`${base}/wiki`} icon={BookOpenIcon} label="Wiki" detail="Quick facts, about, offers and needs, visiting and joining" />}
          </div>
          <p className="mt-4 max-w-[42em] font-serif text-sm leading-relaxed text-soft">
            Changes to its details{showRoles && " and roles"} are proposed to its members, who decide them by consent.
          </p>
        </Section>

        {/* leaving: one-way, so at the foot, apart from the rest, and asked about first */}
        <Section>
          <Button variant="danger" onClick={() => setConfirmingLeave(true)} disabled={leaving} className="w-full">
            <ArrowRightStartOnRectangleIcon className="size-3.5 shrink-0" strokeWidth={2.5} />
            {/* a long name wraps rather than running off the button (Button
                doesn't wrap its label), breaking anywhere if it has to */}
            <span className="min-w-0 whitespace-normal text-center [overflow-wrap:anywhere]">Leave {o.name}</span>
          </Button>
          {leaveError && <p className="mt-3 font-sans text-sm font-bold text-danger">{leaveError}</p>}
        </Section>
      </SectionGroup>

      {confirmingLeave && (
        <ConfirmModal
          title={`Leave ${o.name}?`}
          message={leaveMessage}
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={async () => {
            setConfirmingLeave(false);
            setLeaving(true);
            setLeaveError(null);
            const result = await onLeave();
            if (!result.ok) {
              setLeaveError(result.error);
              setLeaving(false);
            }
          }}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
    </PageContainer>
  );
}
