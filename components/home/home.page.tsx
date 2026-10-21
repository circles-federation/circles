"use client";

import { useState, type ReactNode } from "react";
import { PlayIcon } from "@heroicons/react/24/solid";
import { AlertModal, AttentionDot, EmptyState, Avatar, Chip, LinkRow, Eyebrow, EyebrowGroup, FolderGrid, MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { CircleCard } from "@/components/circles/circle-card";
import { ProposalBanner } from "@/components/circles/proposal-banner";
import { EventFeed } from "@/components/events/event-feed";
import { HomePrompts } from "./home-prompts";
import { TaskTable } from "@/components/circles/task-table";
import { onBackBurner } from "@/lib/tasks.util";
import { StartingSoon } from "./starting-soon";
import { isAttending } from "@/lib/events.util";
import { fmtNumericDate } from "@/lib/format.util";
import { awaitingResponse } from "@/lib/proposals.util";
import { circleNeighborhood, circlesForMember, indexCircles } from "@/lib/circles.util";
import { useMemberById, useMembers } from "@/lib/hooks";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Circle, CircleTask, Event, Profile } from "@/lib/types";

interface HomeProps {
  profile: Profile;
  events: Event[];
  circles: Circle[];
  rsvpState: Record<string, boolean>;
  onOpenEvent: (e: Event) => void;
  onOpenNeighbors: () => void;
  onOpenLocalCircles: () => void;
  onPlayGame: () => void;
  onOpenCircle: (c: Circle) => void;
  onOpenProfile: () => void;
  onOpenTask: (task: CircleTask) => void;
}

/* The user's home dashboard. Their landing surface: identity, their
   neighborhood (one panel among several now), their circles (speed
   dial), and their events. Profile editing lives on a separate page. */
export function Home({ profile, events, circles, rsvpState, onOpenEvent, onOpenNeighbors, onOpenLocalCircles, onPlayGame, onOpenCircle, onOpenProfile, onOpenTask }: HomeProps) {
  const members = useMembers();
  const { pendingReviews, invitations, proposals, tasks } = useAppState();
  // what's yours to do across your circles, most pressing first: not what's
  // done, nor what's on the back burner
  const myTasks = tasks.filter((t) => t.assigneeId === profile.id && t.status !== "done" && !onBackBurner(t));
  // proposals in my circles still waiting on my answer, soonest to close first
  const awaitingMe = proposals.filter((p) => awaitingResponse(p, profile.id)).sort((a, b) => a.closesAt.localeCompare(b.closesAt));
  // the ones I proposed, still open: nothing for me to answer, but the way back
  // to one wherever its circle is (an undecided meeting is in no list)
  const mineOpen = proposals.filter((p) => p.status === "open" && p.proposerId === profile.id).sort((a, b) => a.closesAt.localeCompare(b.closesAt));
  const memberById = useMemberById();
  // invitations to join a circle, sent to me
  const myInvitations = invitations.filter((i) => i.memberId === profile.id);
  const byId = indexCircles(circles);
  const homeCircle = profile.homeCircleId ? byId[profile.homeCircleId] : undefined;
  const neighbors = members.filter((m) => profile.homeCircleId !== null && m.homeCircleId === profile.homeCircleId);
  // the name game quizzes you on everyone in your neighborhood but you, so with
  // no one else there (or no neighborhood) there's nothing to play: say why
  // instead of opening an empty game
  const [noGame, setNoGame] = useState(false);
  const canPlay = neighbors.some((m) => m.id !== profile.id);
  function playGame() {
    if (canPlay) onPlayGame();
    else setNoGame(true);
  }
  // excludes the neighborhood itself — clicking this stat opens that
  // neighborhood's folder page, which shows its children, not itself, so the
  // count would otherwise be one higher than what's actually there to click
  // through to.
  const localCircles = circles.filter((c) => c.type !== "neighborhood" && !!homeCircle && circleNeighborhood(c, byId)?.id === homeCircle.id);

  // the user's own circles (speed dial)
  const myCircles = circlesForMember(profile.id, circles);

  // the user's events — created or RSVP'd, upcoming first then past
  // the user's events — created, RSVP'd or slotted; EventFeed orders and paginates them
  const myEvents = events.filter((e) => isAttending(e, profile.id) || rsvpState[e.id] || e.organizerId === profile.id);

  return (
    <PageContainer size="wide">
      {/* identity masthead */}
      <div className="flex flex-col items-stretch gap-5 border-t-[3px] border-t-ink border-b border-b-ink pt-5 pb-6 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          {/* opens your own profile, as others see it; the photo inverts while pressed */}
          <button type="button" onClick={onOpenProfile} aria-label="View your profile" className="press-invert shrink-0 cursor-pointer border-0 bg-transparent p-0">
            <Avatar member={profile} sizeClassName="size-24 min-[720px]:size-30" showPending />
          </button>
          <div className="min-w-0">
            <h1 className="m-0 font-sans text-title leading-[0.95] font-extrabold tracking-[-0.035em] wrap-break-word">
              <span className="block min-[720px]:inline">{profile.name}</span>
              {profile.lastName && (
                <span title="Stored in the system, but not shown to other members" className="block cursor-help text-ghost min-[720px]:ml-[0.3em] min-[720px]:inline">
                  {profile.lastName}
                </span>
              )}
            </h1>
            <div className="mt-3">
              {homeCircle && <Chip title="Your neighborhood">{homeCircle.name}</Chip>}
            </div>
          </div>
        </div>
      </div>

      <SectionGroup>
        <StartingSoon events={events} memberId={profile.id} rsvpState={rsvpState} />

        <HomePrompts />

        {/* a system admin's way into what's waiting for their review: applications and new photos */}
        {pendingReviews !== null && (
          <Section>
            <EyebrowGroup label={<AttentionLabel on={pendingReviews > 0}>Review</AttentionLabel>}>
              <MenuRow href="/admin/review" label={pendingReviews === 0 ? "Nothing waiting for review" : `${pendingReviews} waiting for review`} />
            </EyebrowGroup>
          </Section>
        )}

        {myInvitations.length > 0 && (
          <Section>
            <EyebrowGroup label={<AttentionLabel on>{myInvitations.length === 1 ? "1 invitation" : `${myInvitations.length} invitations`}</AttentionLabel>}>
              <div className="border-t border-ink">
                {myInvitations.map((inv) => {
                  const by = inv.invitedBy !== undefined ? memberById(inv.invitedBy) : undefined;
                  const sent = fmtNumericDate(inv.createdAt);
                  return (
                    <LinkRow
                      key={inv.id}
                      href={`/invitations/${inv.id}`}
                      // who invited you, as the applications list shows the applicant
                      image={by ? <Avatar member={by} size={56} /> : <div className="size-14 shrink-0 border border-ink bg-faint" />}
                      title={inv.circleName}
                      detail={by ? `Invited by ${by.name} · ${sent}` : `Invited ${sent}`}
                    />
                  );
                })}
              </div>
            </EyebrowGroup>
          </Section>
        )}

        {awaitingMe.length > 0 && (
          <Section>
            <EyebrowGroup label={<AttentionLabel on>{awaitingMe.length === 1 ? "1 proposal" : `${awaitingMe.length} proposals`}</AttentionLabel>}>
              {/* the same banner as on the circle's page, naming the circle,
                  since these can come from any of them */}
              <div className="flex flex-col gap-3">
                {awaitingMe.map((p) => (
                  <ProposalBanner key={p.id} proposal={p} memberId={profile.id} circleName={byId[p.circleId]?.name} />
                ))}
              </div>
            </EyebrowGroup>
          </Section>
        )}

        {mineOpen.length > 0 && (
          <Section>
            {/* no attention dot: these wait on others, not on me */}
            <EyebrowGroup label="Your proposals">
              <div className="flex flex-col gap-3">
                {mineOpen.map((p) => (
                  <ProposalBanner key={p.id} proposal={p} memberId={profile.id} circleName={byId[p.circleId]?.name} />
                ))}
              </div>
            </EyebrowGroup>
          </Section>
        )}

        {myTasks.length > 0 && (
          <Section>
            <EyebrowGroup label="My tasks">
              <TaskTable tasks={myTasks} onOpen={onOpenTask} circleName={(t) => byId[t.circleId]?.name} label="My tasks" showAssignee={false} />
            </EyebrowGroup>
          </Section>
        )}

        {/* my neighborhood, in one short row, so what people come back for
            (their circles and events) stays near the top: its size as two
            links into it, and the name game */}
        {homeCircle && (
          <Section className="py-5">
            {/* the heading over the whole row, not beside the button, so
                its wide-set caps don't wrap on a small phone */}
            <Eyebrow className="text-soft">My neighborhood</Eyebrow>
            <div className="mt-1 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-serif text-base text-soft">
                  <button onClick={onOpenNeighbors} className="hit cursor-pointer border-none bg-transparent p-0 font-serif text-base whitespace-nowrap text-soft underline underline-offset-3">
                    {neighbors.length === 1 ? "1 neighbor" : `${neighbors.length} neighbors`}
                  </button>
                  {" · "}
                  <button onClick={onOpenLocalCircles} className="hit cursor-pointer border-none bg-transparent p-0 font-serif text-base whitespace-nowrap text-soft underline underline-offset-3">
                    {localCircles.length === 1 ? "1 circle" : `${localCircles.length} circles`}
                  </button>
                </div>
              </div>
              {/* the round button inverts while pressed, its label staying put */}
              <button
                onClick={playGame}
                title="Learn your neighbors' names"
                className="fill-press flex shrink-0 cursor-pointer items-center gap-3 border-none bg-transparent p-0 font-sans text-xs font-bold tracking-caps text-teal uppercase"
              >
                {/* on the narrowest phones just the button, so the counts keep a line */}
                <span className="max-[379px]:sr-only">Learn names</span>
                <span className="fill-press-square flex size-11 items-center justify-center rounded-full border-2 border-teal bg-teal text-paper [--press-color:var(--color-teal)]">
                  <PlayIcon className="ml-0.5 size-5" />
                </span>
              </button>
            </div>
          </Section>
        )}

        {/* my circles — speed dial using the same cards as the Circles page */}
        <Section>
          {myCircles.length > 0 ? (
            <FolderGrid
              label="My circles"
              items={myCircles}
              minWidth={300}
              renderItem={(c) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showKindEyebrow />}
            />
          ) : (
            <EyebrowGroup label="My circles">
              <EmptyState action={{ label: "Browse circles", href: "/circles" }}>
                You’re not a member of any circle yet. The circles you join show up here.
              </EmptyState>
            </EyebrowGroup>
          )}
        </Section>

        {/* my events — created or RSVP'd, past and present */}
        <Section>
          <EyebrowGroup label="My events">
            <EventFeed
              events={myEvents}
              onOpenEvent={onOpenEvent}
              pageSize={5}
              emptyText="You're not on any events yet. RSVP to one and it'll show up here."
              emptyAction={{ label: "Browse events", href: "/events" }}
            />
          </EyebrowGroup>
        </Section>
      </SectionGroup>

      {/* pulled down into PageContainer's bottom padding, so on a phone it
          sits just above the bottom nav once scrolled to the very end */}
      <p className="mt-16 -mb-14 text-center font-sans text-label tracking-wide text-soft opacity-60 select-none">
        Circles R1 Beta 1
      </p>

      {noGame && (
        <AlertModal
          title="No neighbors to meet yet"
          message={homeCircle
            ? `You're the only member of ${homeCircle.name} so far. The game helps you learn your neighbors' names, so it'll be ready once someone else joins.`
            : "The game helps you learn your neighbors' names, but you're not part of a neighborhood yet."}
          onClose={() => setNoGame(false)}
        />
      )}
    </PageContainer>
  );
}

// a section's eyebrow carrying the same dot as the Home tab, so it's clear
// which section the tab's dot is about
function AttentionLabel({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="relative">
      {children}
      {on && <AttentionDot className="top-1/2 -right-3.5 -translate-y-1/2" />}
    </span>
  );
}
