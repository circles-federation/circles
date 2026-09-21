import { ArrowTopRightOnSquareIcon, PencilIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, BackButton, Button, Chip, Eyebrow, EyebrowGroup, PageContainer, Section, SectionGroup, Tag } from "@/components/shared";
import { EventFeed } from "@/components/events/event-feed";
import { CircleCard } from "./circle-card";
import { ResourcesSection } from "./resources-section";
import { useAppState } from "@/components/providers/app-state-provider";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { CIRCLE_TYPE_LABEL, circleChildren, circleNeighborhood, isCircleAudience } from "@/lib/circles.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Circle, Event, Member } from "@/lib/types";

interface CirclePageProps {
  circle: Circle;
  isMember: boolean;
  lastEditor: Member | null;
  lastEditedAt?: string;
  events: Event[];
  onBack: () => void;
  backLabel?: string;
  onOpenMember: (m: Member) => void;
  onOpenCircle: (c: Circle) => void;
  onOpenEvent: (e: Event) => void;
  onManage: () => void;
}

export function CirclePage({ circle: c, isMember, lastEditor, lastEditedAt, events, onBack, backLabel, onOpenMember, onOpenCircle, onOpenEvent, onManage }: CirclePageProps) {
  const { profile, circles } = useAppState();
  const byId = useCirclesById();
  const memberById = useMemberById();
  const hood = circleNeighborhood(c, byId);
  const members = c.members.map(memberById).filter((m): m is Member => Boolean(m));
  const childCircles = circleChildren(c, circles);
  // events in this circle — shown to it, or hosted by it — soonest first (location is irrelevant)
  const circleEvents = [...events]
    .filter((e) => e.circleId === c.id || e.hostCircleId === c.id)
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());

  return (
    <PageContainer size="normal">
      <BackButton onClick={onBack}>{backLabel || "All circles"}</BackButton>

      <div className="mt-4 flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <Eyebrow className="text-soft">{CIRCLE_TYPE_LABEL[c.type]}</Eyebrow>
            {hood !== null && (
              <Chip title={hood.id === profile.homeCircleId ? "Local to this neighborhood" : "Across the federation"}>{hood.name}</Chip>
            )}
          </div>
          <h1 className="mt-3 font-sans text-title leading-[0.92] font-extrabold tracking-[-0.035em]">{c.name}</h1>
          <p className="mt-3.5 font-serif text-xl text-[#222] italic">{c.tagline}</p>
          {lastEditor && (
            <div className="mt-4 font-sans text-label tracking-[0.02em] text-soft">
              Last edited by{" "}
              <button
                onClick={() => onOpenMember(lastEditor)}
                className="cursor-pointer border-none bg-transparent p-0 font-sans text-label font-bold tracking-[0.02em] text-ink underline underline-offset-2"
              >
                {lastEditor.name}
              </button>
              {lastEditedAt ? ` · ${fmtEditDate(lastEditedAt)}` : ""}
            </div>
          )}
        </div>
        {isMember && (
          <Button
            variant="secondary"
            onClick={onManage}
            className={clsx("w-full self-stretch", "min-[720px]:w-auto min-[720px]:self-start")}
          >
            <PencilIcon className="size-3.5" strokeWidth={2.5} />
            Manage
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[720px]:grid-cols-4 gap-px bg-faint border-b border-ink">
        {c.facts.map(([k, v]) => (
          <div key={k} className="bg-paper py-4 px-3.5">
            <Eyebrow className="text-soft">{k}</Eyebrow>
            <div className="mt-2 font-sans text-lg font-extrabold tracking-[-0.01em]">{v}</div>
          </div>
        ))}
      </div>

      <SectionGroup>
        {/* members-only: a non-member gets nothing here, not even a placeholder */}
        {isMember && (
          <Section>
            <ResourcesSection circleId={c.id} />
          </Section>
        )}

        <Section>
          <EyebrowGroup label="About">
            <p className="max-w-[40em] font-serif text-lg leading-[1.55]">{c.about}</p>
          </EyebrowGroup>
        </Section>

        <Section>
          <EyebrowGroup label="What they offer">
            {c.offers.map((s) => <Tag key={s}>{s}</Tag>)}
          </EyebrowGroup>
        </Section>

        {/* a circle's events are only ever sent to its own audience, so for
            anyone else this section would be permanently (and misleadingly) empty */}
        {isCircleAudience(c, profile.id) && (
          <Section>
            <Eyebrow className="text-soft">Events</Eyebrow>
            <div className="mt-4">
              <EventFeed
                events={circleEvents}
                onOpenEvent={onOpenEvent}
                emptyText={`No upcoming events in ${c.name}.`}
              />
            </div>
          </Section>
        )}

        {childCircles.length > 0 && (
          <Section>
            <Eyebrow className="text-soft">Sub-circles</Eyebrow>
            {/* the grid's own border-t is the header rule — same as Members below */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] border-t border-l border-ink">
              {childCircles.map((child) => (
                <CircleCard key={child.id} c={child} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} />
              ))}
            </div>
          </Section>
        )}

        <Section>
          <Eyebrow className="text-soft">Members</Eyebrow>
          {members.length > 0 ? (
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] border-t border-l border-ink">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onOpenMember(m)}
                  className="ink-press flex cursor-pointer items-center gap-3 border-r border-b border-ink bg-paper p-3.5 text-left"
                >
                  <Avatar member={m} size={44} />
                  <div className="min-w-0">
                    <div className="font-sans text-sm font-bold">{m.name}</div>
                    <Eyebrow className="text-soft">{m.role}</Eyebrow>
                    {/* everyone here belongs to this circle, so no neighborhood chip —
                        a role they hold in it takes that spot, as an outlined badge */}
                    {rolesHeldBy(c, m.id).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {rolesHeldBy(c, m.id).map((role) => (
                          <span
                            key={role}
                            title={`Role in ${c.name}`}
                            className="ink-press-badge inline-flex items-center whitespace-nowrap border border-ink bg-paper px-2.25 py-1 font-sans text-label font-bold uppercase tracking-[0.08em] text-ink"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 font-serif text-base text-soft">
              No members of {c.name} are listed here yet.
            </p>
          )}
        </Section>

        {(c.website || c.address || (c.hours && c.hours.length > 0)) && (
          <Section>
            <Eyebrow className="text-soft">Visit</Eyebrow>
            {/* the box's own border is the header rule here, fainter than the
                ink one above since it's framing a box rather than a card grid */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] border border-faint">
              <div className="border-r border-b border-faint px-4.5 py-4">
                <Eyebrow className="text-soft">Website</Eyebrow>
                <div className="mt-2">
                  {c.website
                    ? (
                      <a
                        href={`https://${c.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-sans text-sm font-bold text-ink underline underline-offset-2 break-all"
                      >
                        {c.website}
                        <ArrowTopRightOnSquareIcon className="size-3.5" strokeWidth={2.5} />
                      </a>
                    )
                    : <span className="font-serif text-sm text-soft">—</span>}
                </div>
              </div>
              <div className="border-r border-b border-faint px-4.5 py-4">
                <Eyebrow className="text-soft">Address</Eyebrow>
                <div className="mt-2">
                  {c.address
                    ? c.address.split(",").map((line, i) => (
                        <div key={i} className="font-serif text-sm leading-[1.4] text-[#222]">{line.trim()}</div>
                      ))
                    : <span className="font-serif text-sm text-soft">—</span>}
                </div>
              </div>
              <div className="border-b border-faint px-4.5 py-4">
                <Eyebrow className="text-soft">Open hours</Eyebrow>
                <div className="mt-2">
                  {c.hours && c.hours.length > 0
                    ? c.hours.map(([d, t]) => (
                        <div key={d} className="flex justify-between gap-3 py-px font-serif text-sm text-[#222]">
                          <span className="text-soft">{d}</span>
                          <span>{t}</span>
                        </div>
                      ))
                    : <span className="font-serif text-sm text-soft">—</span>}
                </div>
              </div>
            </div>
          </Section>
        )}
      </SectionGroup>

      <section className="pt-8">
        <div className="grid grid-cols-1 border border-ink min-[720px]:grid-cols-2">
          <div className="border-b border-ink p-6 min-[720px]:border-r min-[720px]:border-b-0">
            <Eyebrow className="text-soft">How to join</Eyebrow>
            <p className="mt-3 font-serif text-base leading-normal">{c.join}</p>
          </div>
          <div className="bg-ink p-6 text-paper">
            <Eyebrow className="text-[#bdbdbd]">Get in touch</Eyebrow>
            <p className="mt-3 font-sans text-lg font-bold wrap-break-word">{c.contact}</p>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
