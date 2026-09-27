import { useState } from "react";
import { ArrowTopRightOnSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, Chip, Eyebrow, EyebrowGroup, GhostIconButton, PageContainer, Section, SectionGroup, SimpleTabs, Tag } from "@/components/shared";
import { EventFeed } from "@/components/events/event-feed";
import { CircleCard } from "./circle-card";
import { BulletinSection } from "./bulletin-section";
import { useAppState } from "@/components/providers/app-state-provider";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { CIRCLE_TYPE_LABEL, circleChildren, circleWebsiteUrl, isCircleAudience } from "@/lib/circles.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Circle, CircleResource, Event, Member } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";

const CIRCLE_TABS = ["bulletin", "wiki", "members", "events"] as const;
type CircleTab = (typeof CIRCLE_TABS)[number];

interface CirclePageProps {
  circle: Circle;
  isMember: boolean;
  lastEditor: Member | null;
  lastEditedAt?: string;
  events: Event[];
  onOpenMember: (m: Member) => void;
  onOpenCircle: (c: Circle) => void;
  onOpenEvent: (e: Event) => void;
  // the new event form, hosted by this circle
  onNewEvent: () => void;
  // a bulletin item's form as a page, which is what a phone gets instead of
  // the dialog: a new one, or an existing one to edit
  onAddResourcePage: () => void;
  onEditResourcePage: (resource: CircleResource) => void;
  // the tab to open on (e.g. restored on Back), and a note of each change so
  // the route can remember it
  initialTab?: string | null;
  onTabChange: (tab: string) => void;
}

export function CirclePage({ circle: c, isMember, lastEditor, lastEditedAt, events, onOpenMember, onOpenCircle, onOpenEvent, onNewEvent, onAddResourcePage, onEditResourcePage, initialTab, onTabChange }: CirclePageProps) {
  const { profile, circles } = useAppState();
  const memberById = useMemberById();
  const members = c.members.map(memberById).filter((m): m is Member => Boolean(m));
  const childCircles = circleChildren(c, circles);
  const byId = useCirclesById();
  const parent = c.parentId !== null ? byId[c.parentId] : undefined;
  // events in this circle — shown to it, or hosted by it — soonest first (location is irrelevant)
  const circleEvents = [...events]
    .filter((e) => e.circleId === c.id || e.hostCircleId === c.id)
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());
  // a member lands on the bulletin, the members-only tab; anyone else on the
  // wiki, with no hint a bulletin exists
  const [tab, setTab] = useState<CircleTab>(
    initialTab && CIRCLE_TABS.includes(initialTab as CircleTab) ? (initialTab as CircleTab) : isMember ? "bulletin" : "wiki",
  );
  function changeTab(key: CircleTab) {
    setTab(key);
    onTabChange(key);
  }
  const activeTab = !isMember && tab === "bulletin" ? "wiki" : tab;
  const tabs: { key: CircleTab; label: string }[] = [
    ...(isMember ? [{ key: "bulletin" as const, label: "Bulletin" }] : []),
    { key: "wiki", label: "Wiki" },
    { key: "members", label: "Members" },
    { key: "events", label: "Events" },
  ];
  const websiteUrl = c.website ? circleWebsiteUrl(c.website) : null;
  // the bulletin's + lives in the tab row, so opening its add dialog is kept here
  const [adding, setAdding] = useState(false);
  const startAdding = () => (isPhoneWidth() ? onAddResourcePage() : setAdding(true));

  return (
    <PageContainer size="normal">
      <div className="flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="min-w-0 flex-1">
          {/* where it sits in the tree: its parent, as a chip opposite the type */}
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="shrink-0 text-soft">{CIRCLE_TYPE_LABEL[c.type]}</Eyebrow>
            {parent && (
              <span className="flex min-w-0 justify-end">
                <Chip title={`Part of ${parent.name}`} onClick={() => onOpenCircle(parent)}>
                  {parent.name}
                </Chip>
              </span>
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
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[720px]:grid-cols-4 gap-px bg-faint border-b border-ink">
        {c.facts.map(([k, v]) => (
          <div key={k} className="bg-paper py-4 px-3.5">
            <Eyebrow className="text-soft">{k}</Eyebrow>
            <div className="mt-2 font-sans text-lg font-extrabold tracking-[-0.01em]">{v}</div>
          </div>
        ))}
      </div>

      <SimpleTabs
        className="mt-6"
        tabs={tabs}
        active={activeTab}
        onChange={(key) => changeTab(key as CircleTab)}
        actions={
          activeTab === "bulletin" ? (
            <GhostIconButton icon={PlusIcon} label="Add item" onClick={startAdding} className="-my-2.5 -mr-2.5" />
          ) : activeTab === "events" && isMember ? (
            // only a member can host from the circle
            <GhostIconButton icon={PlusIcon} label="New event" onClick={onNewEvent} className="-my-2.5 -mr-2.5" />
          ) : null
        }
      />

      {activeTab === "bulletin" && (
        <SectionGroup>
          <Section>
            <BulletinSection circleId={c.id} adding={adding} onAdd={startAdding} onAddingDone={() => setAdding(false)} onEditPage={onEditResourcePage} />
          </Section>
        </SectionGroup>
      )}

      {activeTab === "wiki" && (
        <>
          <SectionGroup>
            <Section>
              <EyebrowGroup label="About">
                <p className="max-w-[40em] font-serif text-lg leading-[1.55]">{c.about}</p>
              </EyebrowGroup>
            </Section>

            {c.offers.length > 0 && (
              <Section>
                <EyebrowGroup label="What they offer">
                  {c.offers.map((s) => <Tag key={s}>{s}</Tag>)}
                </EyebrowGroup>
              </Section>
            )}

            {c.needs.length > 0 && (
              <Section>
                <EyebrowGroup label="What they need">
                  {c.needs.map((s) => <Tag key={s}>{s}</Tag>)}
                </EyebrowGroup>
              </Section>
            )}

            {childCircles.length > 0 && (
              <Section>
                <Eyebrow className="text-soft">Sub-circles</Eyebrow>
                {/* the grid's own border-t is the header rule, as on the Members tab */}
                <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] border-t border-l border-ink">
                  {childCircles.map((child) => (
                    <CircleCard key={child.id} c={child} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} />
                  ))}
                </div>
              </Section>
            )}

            {(c.website || c.address || (c.hours && c.hours.length > 0)) && (
              <Section>
                <Eyebrow className="text-soft">Visit</Eyebrow>
                {/* the box's own border is the header rule here, fainter than the
                    ink one above since it's framing a box rather than a card grid.
                    Every cell rules its right and bottom, and the grid runs 1px
                    past the box, clipped, so however the cells wrap the ones on
                    its edge don't double the box's own border */}
                <div className="mt-4 overflow-hidden border border-faint">
                  <div className="-mr-px -mb-px grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
                    <div className="border-r border-b border-faint px-4.5 py-4">
                      <Eyebrow className="text-soft">Website</Eyebrow>
                      <div className="mt-2">
                        {websiteUrl
                          ? (
                            // just the domain, as a bulletin card shows a link
                            <a
                              href={websiteUrl.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-sans text-sm font-bold text-ink underline underline-offset-2 break-all"
                            >
                              {websiteUrl.hostname.replace(/^www\./, "")}
                              <ArrowTopRightOnSquareIcon className="size-3.5" strokeWidth={2.5} />
                            </a>
                          )
                          // not an address it can link to, so shown as typed
                          : c.website
                            ? <span className="font-sans text-sm font-bold break-all text-ink">{c.website}</span>
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
                    <div className="border-r border-b border-faint px-4.5 py-4">
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
                </div>
              </Section>
            )}
          </SectionGroup>

          {(c.join || c.contact) && (
            <section className="pt-8">
              <div
                className={clsx(
                  "grid grid-cols-1 border border-ink",
                  c.join && c.contact && "min-[720px]:grid-cols-2",
                )}
              >
                {c.join && (
                  <div
                    className={clsx(
                      "p-6",
                      c.contact && "border-b border-ink min-[720px]:border-r min-[720px]:border-b-0",
                    )}
                  >
                    <Eyebrow className="text-soft">How to join</Eyebrow>
                    <p className="mt-3 font-serif text-base leading-normal">{c.join}</p>
                  </div>
                )}
                {c.contact && (
                  <div className="bg-ink p-6 text-paper">
                    <Eyebrow className="text-[#bdbdbd]">Get in touch</Eyebrow>
                    <p className="mt-3 font-sans text-lg font-bold wrap-break-word">{c.contact}</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "members" && (
        <SectionGroup>
          <Section>
            {members.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] border-t border-l border-ink">
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
              <p className="font-serif text-base text-soft">
                No members of {c.name} are listed here yet.
              </p>
            )}
          </Section>
        </SectionGroup>
      )}

      {activeTab === "events" && (
        <SectionGroup>
          <Section>
            <EventFeed
              events={circleEvents}
              onOpenEvent={onOpenEvent}
              // events shown to a circle are only ever sent to its own members
              // (and, for the city, everyone), so an outsider only sees the
              // ones it hosts for a circle they're in — the empty state says
              // that, rather than implying none of its events are public
              emptyText={isCircleAudience(c, profile.id)
                ? `No upcoming events in ${c.name}.`
                : `${c.name} isn't hosting any events open to you.`}
            />
          </Section>
        </SectionGroup>
      )}
    </PageContainer>
  );
}
