"use client";

import { PencilIcon } from "@heroicons/react/24/outline";
import { PlayIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Avatar, Button, Chip, Eyebrow, EyebrowGroup, FolderGrid, Section, SectionGroup } from "@/components/shared";
import { OrgCard } from "@/components/orgs/org-card";
import { EventFeed } from "@/components/events/event-feed";
import { StatCard } from "./stat-card";
import { MEMBERS } from "@/lib/data";
import { isPastEvent, parseDay } from "@/lib/format.util";
import { useIsMobile } from "@/lib/hooks";
import { orgMembers, orgScope } from "@/lib/orgs.util";

/* The user's home dashboard. Their landing surface: identity, their
   neighborhood (one panel among several now), their organizations (speed
   dial), and their events. Profile editing lives on a separate page. */
export function Home({ profile, events, orgs, rsvpState, onOpenEvent, setView, onOpenNeighbors, onOpenLocalOrgs, onPlayGame, onOpenOrg, onEditProfile }) {
  const isMobile = useIsMobile();
  const orgsById = orgs.reduce((acc, o) => { acc[o.id] = o; return acc; }, {});
  const neighbors = MEMBERS.filter((m) => m.neighborhood === profile.neighborhood);
  // excludes the neighborhood's own Council (o.neighborhood set) — clicking
  // this stat opens that Council's folder page, which shows its children,
  // not itself, so the count would otherwise be one higher than what's
  // actually there to click through to.
  const localCircles = orgs.filter((o) => orgScope(o, orgsById) === profile.neighborhood && !o.neighborhood);
  const upcoming = [...events].filter((e) => !isPastEvent(e)).sort((a, b) => parseDay(a.date) - parseDay(b.date));
  const meetings = upcoming.filter((e) => e.kind === "meeting" && orgsById[e.orgId]?.neighborhood === profile.neighborhood);

  // the user's own organizations (speed dial)
  const myOrgs = orgs.filter((o) => orgMembers(o, MEMBERS).includes(profile.id));

  // the user's events — created or RSVP'd, upcoming first then past
  // the user's events — created or RSVP'd; EventFeed orders and paginates them
  const myEvents = events.filter((e) => (e.rsvps || []).includes(profile.id) || rsvpState[e.id] || (e.host && e.host.type === "member" && e.host.id === profile.id));

  return (
    <div className="mx-auto max-w-270 px-6 pt-9 pb-20">
      {/* identity masthead */}
      <div className="flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4.5 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <Avatar member={profile} size={isMobile ? 64 : 96} />
          <div className="min-w-0">
            <h1 className="m-0 font-sans text-title leading-[0.95] font-extrabold tracking-[-0.035em]">
              {profile.name}
              {profile.lastName && (
                <span title="Stored in the system, but not shown to other members" className="ml-[0.3em] cursor-help text-[#9a9a9a]">
                  {profile.lastName}
                </span>
              )}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-serif text-lg text-soft">{profile.pronouns} · {profile.role}</span>
              <Chip title="Your neighborhood">{profile.neighborhood}</Chip>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={onEditProfile}
          className={clsx("w-full self-stretch", "min-[720px]:w-auto min-[720px]:self-start")}
        >
          <PencilIcon className="size-3.5" strokeWidth={2.5} />
          Edit profile
        </Button>
      </div>

      <SectionGroup>
        {/* my neighborhood — one compact panel of stats */}
        <Section>
          <EyebrowGroup label="My neighborhood">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-4">
              <StatCard value={neighbors.length} label="Neighbors" onClick={onOpenNeighbors} />
              <StatCard value={localCircles.length} label="Local circles" onClick={onOpenLocalOrgs} />
              <StatCard value={meetings.length} label="Upcoming meetings" onClick={() => setView("events")} />
              <button
                onClick={onPlayGame}
                title="Play the neighbor name game"
                className="btn-invert btn-teal flex aspect-square w-full cursor-pointer flex-col items-stretch justify-between border border-teal bg-teal p-5 text-paper"
              >
                <Eyebrow className="text-left text-paper">Meet My Neighbors</Eyebrow>
                <PlayIcon className="h-(--text-hero) w-(--text-hero) self-end" />
              </button>
            </div>
          </EyebrowGroup>
        </Section>

        {/* my organizations — speed dial using the same cards as the directory */}
        <Section>
          {myOrgs.length > 0 ? (
            <FolderGrid
              label="My circles"
              items={myOrgs}
              minWidth={300}
              renderItem={(o) => <OrgCard key={o.id} o={o} onOpenOrg={onOpenOrg} showKindEyebrow />}
            />
          ) : (
            <EyebrowGroup label="My circles">
              <p className="font-serif text-base text-soft">
                You’re not a member of any organization yet. Browse the directory to find one.
              </p>
            </EyebrowGroup>
          )}
        </Section>

        {/* my events — created or RSVP'd, past and present */}
        <Section>
          <Eyebrow className="text-soft">My events</Eyebrow>
          <EventFeed
            events={myEvents}
            onOpenEvent={onOpenEvent}
            pageSize={5}
            topBorder
            emptyText="You're not on any events yet. RSVP to one and it'll show up here."
          />
        </Section>
      </SectionGroup>
    </div>
  );
}
