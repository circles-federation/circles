"use client";

import { useState, type ReactNode } from "react";
import { PlayIcon } from "@heroicons/react/24/solid";
import { AlertModal, AttentionDot, EmptyState, Avatar, Chip, LinkRow, Eyebrow, EyebrowGroup, FolderGrid, MenuRow, PageContainer, Section, SectionGroup } from "@/components/shared";
import { CircleCard } from "@/components/circles/circle-card";
import { ProposalBanner } from "@/components/circles/proposal-banner";
import { EventFeed } from "@/components/events/event-feed";
import { HomePrompts } from "./home-prompts";
import { StartingSoon } from "./starting-soon";
import { StatCard } from "./stat-card";
import { isAttending } from "@/lib/events.util";
import { fmtNumericDate, isPastEvent, parseDay } from "@/lib/format.util";
import { awaitingResponse } from "@/lib/proposals.util";
import { circleNeighborhood, circlesForMember, indexCircles } from "@/lib/circles.util";
import { useMemberById, useMembers } from "@/lib/hooks";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Circle, Event, Profile } from "@/lib/types";

interface HomeProps {
  profile: Profile;
  events: Event[];
  circles: Circle[];
  rsvpState: Record<string, boolean>;
  onOpenEvent: (e: Event) => void;
  setView: (key: string) => void;
  onOpenNeighbors: () => void;
  onOpenLocalCircles: () => void;
  onPlayGame: () => void;
  onOpenCircle: (c: Circle) => void;
  onOpenProfile: () => void;
}

/* The user's home dashboard. Their landing surface: identity, their
   neighborhood (one panel among several now), their circles (speed
   dial), and their events. Profile editing lives on a separate page. */
export function Home({ profile, events, circles, rsvpState, onOpenEvent, setView, onOpenNeighbors, onOpenLocalCircles, onPlayGame, onOpenCircle, onOpenProfile }: HomeProps) {
  const members = useMembers();
  const { pendingApplications, invitations, proposals } = useAppState();
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
  const upcoming = [...events].filter((e) => !isPastEvent(e)).sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());
  // circleNeighborhood (not a direct check on the event's circle) so a
  // meeting held by a sub-circle (e.g. Finance Council) still counts as "in
  // my neighborhood", not just one held by the neighborhood itself
  const meetings = upcoming.filter((e) => {
    if (e.kind !== "meeting" || e.cancelled) return false;
    const circle = byId[e.circleId];
    return !!circle && !!homeCircle && circleNeighborhood(circle, byId)?.id === homeCircle.id;
  });

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
            <Avatar member={profile} sizeClassName="size-24 min-[720px]:size-30" />
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

        {/* a system admin's way into the applications waiting for them */}
        {pendingApplications !== null && (
          <Section>
            <EyebrowGroup label={<AttentionLabel on={pendingApplications > 0}>Applications</AttentionLabel>}>
              <MenuRow href="/admin/applications" label={pendingApplications === 0 ? "Nothing waiting for review" : `${pendingApplications} waiting for review`} />
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

        {/* my neighborhood — one compact panel of stats */}
        <Section>
          <EyebrowGroup label="My neighborhood">
            {/* a row of three short stat cards, and the game as a bar under
                them on a phone (beside them wider) */}
            <div className="grid grid-cols-3 gap-3 min-[720px]:grid-cols-4">
              <StatCard value={neighbors.length} label="Neighbors" onClick={onOpenNeighbors} />
              <StatCard value={localCircles.length} label="Local circles" onClick={onOpenLocalCircles} />
              <StatCard value={meetings.length} label="Upcoming meetings" onClick={() => setView("events")} />
              <button
                onClick={playGame}
                title="Play the neighbor name game"
                className="btn-invert btn-teal col-span-3 flex w-full cursor-pointer items-center justify-between gap-3 border border-teal bg-teal px-4 py-4 text-paper min-[720px]:col-span-1 min-[720px]:flex-col min-[720px]:items-start"
              >
                <Eyebrow className="text-left text-paper">Meet My Neighbors</Eyebrow>
                <PlayIcon className="size-8 min-[720px]:self-end" />
              </button>
            </div>
          </EyebrowGroup>
        </Section>

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
