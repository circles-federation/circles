"use client";

import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { CirclePage } from "@/components/circles/circle.page";
import { NeighborhoodPage } from "@/components/circles/neighborhood.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { circleSections, defaultCircleSection, isCircleMember, isCircleSection, type CircleSection } from "@/lib/circles.util";
import { useAppNav, useMemberById, useMembers } from "@/lib/hooks";

/* Every circle lives at /circles/[id], however deep it sits in the tree: a
   neighborhood as its folder view, every other circle as its page, opening
   on its default section, with each section at /circles/[id]/[section]
   (shared by those routes, so they're one page). Keying by the circle's own
   stable id rather than its position in the hierarchy means reparenting a
   circle (its Parent field on the manage page) never changes its URL. A
   section someone doesn't have (a non-member's tasks) doesn't exist for
   them. */
export function CircleRoute({ section }: { section?: CircleSection }) {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { circles, events, profile } = useAppState();
  const nav = useAppNav();
  const members = useMembers();
  const memberById = useMemberById();

  const circle = circles.find((c) => c.id === id);
  if (!circle) notFound();

  if (circle.type === "neighborhood") {
    if (section) notFound();
    return (
      <NeighborhoodPage
        circle={circle}
        circles={circles}
        members={members}
        profile={profile}
        onOpenCircle={(c) => nav.openCircle(c)}
        onOpenMember={nav.openMember}
        onProposePost={() => router.push(`/circles/${circle.id}/bulletin/new`)}
        initialTypeFilter={searchParams.get("types")?.split(",")}
      />
    );
  }

  const isMember = isCircleMember(circle, profile.id);
  // an old link's ?tab= still opens its section
  const tab = searchParams.get("tab") ?? undefined;
  const shown = section ?? (isCircleSection(tab) ? tab : defaultCircleSection(circle, isMember));
  if (!circleSections(circle, isMember).includes(shown)) notFound();

  return (
    <CirclePage
      // a section of its own, so its forms and dialogs start afresh
      key={shown}
      circle={circle}
      section={shown}
      isMember={isMember}
      lastEditor={circle.lastEditedBy ? memberById(circle.lastEditedBy) || null : null}
      lastEditedAt={circle.lastEditedAt}
      events={events}
      onOpenMember={nav.openMember}
      onOpenCircle={(c) => nav.openCircle(c)}
      onOpenEvent={(e) => nav.openEvent(e)}
      // the form starts hosted by the circle (for a group, a proposal to it)
      onNewEvent={() => nav.newEvent(circle)}
      onAddResourcePage={() => nav.addResource(circle)}
      onEditResourcePage={(r) => nav.editResource(r)}
      onAddTaskPage={() => router.push(`/circles/${circle.id}/tasks/new`)}
      onOpenTaskPage={(t) => router.push(`/circles/${t.circleId}/tasks/${t.id}`)}
      onInvitePage={() => nav.inviteTo(circle)}
      onOpenInvitation={(i) => nav.openInvitation(i)}
      // a section's form asked for from another section (the menu's Post on
      // bulletin, on desktop): opened once this section is showing
      startNew={searchParams.get("new") === "1"}
      // replace, not push: switching sections isn't a step Back should retrace
      onGoToSection={(s, opts) => router.replace(`/circles/${circle.id}/${s}${opts?.startNew ? "?new=1" : ""}`)}
    />
  );
}
