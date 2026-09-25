"use client";

import { useState } from "react";
import { ArrowRightStartOnRectangleIcon, PencilIcon } from "@heroicons/react/24/outline";
import { PlayIcon } from "@heroicons/react/24/solid";
import { AlertModal, Avatar, Button, Chip, Eyebrow, EyebrowGroup, FolderGrid, PageContainer, Section, SectionGroup } from "@/components/shared";
import { CircleCard } from "@/components/circles/circle-card";
import { EventFeed } from "@/components/events/event-feed";
import { StatCard } from "./stat-card";
import { isPastEvent, parseDay } from "@/lib/format.util";
import { circleNeighborhood, circlesForMember, indexCircles } from "@/lib/circles.util";
import { useMembers } from "@/lib/hooks";
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
  onEditProfile: () => void;
  onLogout: () => void;
}

/* The user's home dashboard. Their landing surface: identity, their
   neighborhood (one panel among several now), their circles (speed
   dial), and their events. Profile editing lives on a separate page. */
export function Home({ profile, events, circles, rsvpState, onOpenEvent, setView, onOpenNeighbors, onOpenLocalCircles, onPlayGame, onOpenCircle, onEditProfile, onLogout }: HomeProps) {
  const members = useMembers();
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
  // the user's events — created or RSVP'd; EventFeed orders and paginates them
  const myEvents = events.filter((e) => (e.rsvps || []).includes(profile.id) || rsvpState[e.id] || e.organizerId === profile.id);

  return (
    <PageContainer size="wide">
      {/* identity masthead */}
      <div className="flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4.5 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <Avatar member={profile} sizeClassName="size-24 min-[720px]:size-30" />
          <div className="min-w-0">
            <h1 className="m-0 font-sans text-title leading-[0.95] font-extrabold tracking-[-0.035em]">
              {profile.name}
              {profile.lastName && (
                <span title="Stored in the system, but not shown to other members" className="ml-[0.3em] cursor-help text-[#9a9a9a]">
                  {profile.lastName}
                </span>
              )}
            </h1>
            <div className="mt-3">
              {homeCircle && <Chip title="Your neighborhood">{homeCircle.name}</Chip>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2.5 min-[720px]:grid-cols-[auto_auto]">
          <button
            onClick={onEditProfile}
            title="Edit profile"
            aria-label="Edit profile"
            className="ink-press inline-flex aspect-square cursor-pointer items-center justify-center border border-ink bg-paper p-3.25"
          >
            <PencilIcon className="size-3.5" strokeWidth={2.5} />
          </button>
          <Button variant="danger" onClick={onLogout}>
            <ArrowRightStartOnRectangleIcon className="size-3.5" strokeWidth={2.5} />
            Log out
          </Button>
        </div>
      </div>

      <SectionGroup>
        {/* my neighborhood — one compact panel of stats */}
        <Section>
          <EyebrowGroup label="My neighborhood">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min((100%-1rem)/2,160px),1fr))] gap-4">
              <StatCard value={neighbors.length} label="Neighbors" onClick={onOpenNeighbors} />
              <StatCard value={localCircles.length} label="Local circles" onClick={onOpenLocalCircles} />
              <StatCard value={meetings.length} label="Upcoming meetings" onClick={() => setView("events")} />
              <button
                onClick={playGame}
                title="Play the neighbor name game"
                className="btn-invert btn-teal flex aspect-square w-full cursor-pointer flex-col items-stretch justify-between border border-teal bg-teal p-5 text-paper"
              >
                <Eyebrow className="text-left text-paper">Meet My Neighbors</Eyebrow>
                <PlayIcon className="h-(--text-hero) w-(--text-hero) self-end" />
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
              <p className="font-serif text-base text-soft">
                You’re not a member of any circle yet. Browse Circles to find one.
              </p>
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
            />
          </EyebrowGroup>
        </Section>
      </SectionGroup>

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
