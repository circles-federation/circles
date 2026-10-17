import { useState, useSyncExternalStore, type ComponentType, type ReactNode, type SVGProps } from "react";
import { GlobeAltIcon, MapIcon, PlusIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, Eyebrow, EyebrowGroup, MastheadChip, PageContainer, PrivateLabel, Section, SectionGroup, SimpleTabs, Tag } from "@/components/shared";
import { EventFeed } from "@/components/events/event-feed";
import { CircleCard } from "./circle-card";
import { BulletinSection } from "./bulletin-section";
import { InviteModal } from "./invite-picker";
import { useAppState } from "@/components/providers/app-state-provider";
import { useFloatingAction } from "@/components/providers/floating-action-provider";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { CIRCLE_TYPE_LABEL, circleChildren, circleHasWiki, circleWebsiteUrl, isCircleAudience, isGroup } from "@/lib/circles.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Circle, CircleInvitation, CircleResource, Event, Member } from "@/lib/types";
import { mapsPlatform, mapsUrl, type MapsPlatform } from "@/lib/maps.util";
import { isPhoneWidth } from "@/lib/viewport";
import { ProposalBanner } from "./proposal-banner";

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
  // inviting people as a page (a phone; desktop gets a dialog), and an invitation's own page
  onInvitePage: () => void;
  onOpenInvitation: (invitation: CircleInvitation) => void;
  // the tab to open on (e.g. restored on Back), and a note of each change so
  // the route can remember it
  initialTab?: string | null;
  onTabChange: (tab: string) => void;
}

export function CirclePage({ circle: c, isMember, lastEditor, lastEditedAt, events, onOpenMember, onOpenCircle, onOpenEvent, onNewEvent, onAddResourcePage, onEditResourcePage, onInvitePage, onOpenInvitation, initialTab, onTabChange }: CirclePageProps) {
  const { profile, circles, invitations, proposals } = useAppState();
  // its open proposals: a change to the circle, and any events it's deciding
  const openProposals = proposals.filter((p) => p.circleId === c.id && p.status === "open");
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
  // a group has no wiki (see circleHasWiki), and only its members ever see it
  const hasWiki = circleHasWiki(c);
  const activeTab = !isMember && tab === "bulletin" ? "wiki" : !hasWiki && tab === "wiki" ? "bulletin" : tab;
  const tabs: { key: CircleTab; label: string }[] = [
    ...(isMember ? [{ key: "bulletin" as const, label: "Bulletin" }] : []),
    ...(hasWiki ? [{ key: "wiki" as const, label: "Wiki" }] : []),
    { key: "members", label: "Members" },
    { key: "events", label: "Events" },
  ];
  const websiteUrl = c.website ? circleWebsiteUrl(c.website) : null;
  // the bulletin's + lives in the tab row, so opening its add dialog is kept here
  const [adding, setAdding] = useState(false);
  const startAdding = () => (isPhoneWidth() ? onAddResourcePage() : setAdding(true));
  const [inviting, setInviting] = useState(false);
  const startInviting = () => (isPhoneWidth() ? onInvitePage() : setInviting(true));
  // this circle's invitations not yet accepted
  const invited = invitations.filter((i) => i.circleId === c.id);

  // the active tab's floating action: add to the bulletin, invite someone,
  // or host an event (only a member can); none on the wiki
  useFloatingAction(
    activeTab === "bulletin"
      ? { label: "Add to bulletin", icon: PlusIcon, onAction: startAdding }
      : activeTab === "members" && isMember
        ? { label: "Invite", icon: UserPlusIcon, onAction: startInviting }
        : activeTab === "events" && isMember
          ? { label: "New event", icon: PlusIcon, onAction: onNewEvent }
          : null
  );

  return (
    <PageContainer size="normal">
      <div className="flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="min-w-0 flex-1">
          {/* where it sits in the tree: its parent, as a chip opposite the type */}
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="shrink-0 text-soft">
              {isGroup(c) ? <PrivateLabel>{CIRCLE_TYPE_LABEL[c.type]}</PrivateLabel> : CIRCLE_TYPE_LABEL[c.type]}
            </Eyebrow>
            {parent && (
              <MastheadChip title={`Part of ${parent.name}`} onClick={() => onOpenCircle(parent)}>
                {parent.name}
              </MastheadChip>
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

      {openProposals.map((p) => <ProposalBanner key={p.id} proposal={p} memberId={profile.id} className="mt-6" />)}

      <SimpleTabs
        className="mt-6"
        tabs={tabs}
        active={activeTab}
        onChange={(key) => changeTab(key as CircleTab)}
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
          {/* the circle's quick facts open its wiki, as a small table: each
              fact's own label is its heading. Before the sections rather than
              one of them, since it ends on its own ink rule and needs no
              hairline after it */}
          {c.facts.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-px border-y border-ink bg-faint min-[480px]:grid-cols-2 min-[720px]:grid-cols-4">
              {c.facts.map(([k, v]) => (
                <div key={k} className="bg-paper px-3.5 py-4">
                  <Eyebrow className="text-soft">{k}</Eyebrow>
                  <div className="mt-2 font-sans text-lg font-extrabold tracking-[-0.01em]">{v}</div>
                </div>
              ))}
            </div>
          )}
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

            {/* where to find it online and in person: a square each, opening
                its website or its address in the visitor's maps app */}
            {(websiteUrl || c.address) && (
              <Section>
                <div className="flex flex-wrap gap-3 min-[720px]:gap-x-10 min-[720px]:gap-y-4">
                  {websiteUrl && (
                    <VisitLink
                      href={websiteUrl.href}
                      newTab
                      icon={GlobeAltIcon}
                      tone="action"
                      label="Website"
                      value={websiteUrl.hostname.replace(/^www\./, "")}
                    />
                  )}
                  {c.address && <MapsLink address={c.address} />}
                </div>
              </Section>
            )}

            {c.hours && c.hours.length > 0 && (
              <Section>
                <EyebrowGroup label="Open hours">
                  <div className="max-w-90">
                    {c.hours.map(([d, t]) => (
                      <div key={d} className="flex justify-between gap-3 border-b border-faint py-2 font-serif text-base text-[#222] last:border-b-0">
                        <span className="text-soft">{d}</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </EyebrowGroup>
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
          {/* invitations not yet accepted — shown to the circle's members (and
              to the person invited, their own), each opening its page */}
          {invited.length > 0 && (
            <Section>
              <Eyebrow className="text-soft">Invited</Eyebrow>
              <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] border-t border-l border-ink">
                {invited.map((inv) => {
                  const m = memberById(inv.memberId);
                  const by = inv.invitedBy !== undefined ? memberById(inv.invitedBy) : undefined;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => onOpenInvitation(inv)}
                      className="ink-press flex cursor-pointer items-center gap-3 border-r border-b border-ink bg-paper p-3.5 text-left"
                    >
                      {m && <Avatar member={m} size={44} />}
                      <div className="min-w-0">
                        <div className="font-sans text-sm font-bold">{m?.name ?? "Someone"}{m?.id === profile.id && <span className="font-semibold text-soft"> (you)</span>}</div>
                        <Eyebrow className="text-soft">{by ? `Invited by ${by.id === profile.id ? "you" : by.name}` : "Invited"}</Eyebrow>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
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
      {inviting && <InviteModal circle={c} onClose={() => setInviting(false)} />}
    </PageContainer>
  );
}

const noSubscribe = () => () => {};
const currentMapsPlatform = (): MapsPlatform => mapsPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

// a circle's address, opening it in the visitor's maps app (see
// lib/maps.util.ts); Google Maps on the web until the browser says which
// device it is
function MapsLink({ address }: { address: string }) {
  const platform = useSyncExternalStore(noSubscribe, currentMapsPlatform, () => "web" as const);
  const href = mapsUrl(address, platform);
  return (
    <VisitLink
      href={href}
      // a geo: link opens an app on the phone itself, not a new tab
      newTab={!href.startsWith("geo:")}
      icon={MapIcon}
      tone="leaf"
      label="Address"
      // the street, then the rest ("Providence, RI") on a line of its own
      value={(() => {
        const [street, ...rest] = address.split(",").map((part) => part.trim());
        return (
          <>
            <span className="block">{street}</span>
            {rest.length > 0 && <span className="block">{rest.join(", ")}</span>}
          </>
        );
      })()}
      name={`Directions to ${address}`}
    />
  );
}

const VISIT_TONE = {
  action: "border-action bg-action [--press-color:var(--color-action)]",
  leaf: "border-leaf bg-leaf [--press-color:var(--color-leaf)]",
};

/* A filled square with an icon, for one way to reach a circle (its website,
   its address), opening it. On a phone just the square; from the desktop
   breakpoint, what it opens beside it, all one link. Pressed, the square
   inverts (fill-press). */
function VisitLink({ href, newTab, icon: Icon, tone, label, value, name }: { href: string; newTab: boolean; icon: ComponentType<SVGProps<SVGSVGElement>>; tone: keyof typeof VISIT_TONE; label: string; value: ReactNode; name?: string }) {
  const plain = typeof value === "string" ? value : undefined;
  return (
    <a
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={name ?? `${label}: ${plain}`}
      title={plain ?? name}
      className="fill-press flex items-center gap-4 text-ink no-underline"
    >
      <span className={clsx("fill-press-square flex size-16 shrink-0 items-center justify-center border-2 text-paper", VISIT_TONE[tone])}>
        <Icon className="size-8" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="hidden min-w-0 min-[720px]:block" aria-hidden>
        <Eyebrow className="text-soft">{label}</Eyebrow>
        <div className="mt-1 font-serif text-base leading-[1.35] text-[#222]">{value}</div>
      </div>
    </a>
  );
}
