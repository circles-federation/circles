import { useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode, type SVGProps } from "react";
import { CalendarIcon, CheckCircleIcon, Cog6ToothIcon, EnvelopeIcon, GlobeAltIcon, MapIcon, PhoneIcon, PlusIcon, UserGroupIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, Eyebrow, EyebrowGroup, MastheadChip, PageContainer, PrivateLabel, Section, SectionGroup, Tag } from "@/components/shared";
import { EventFeed } from "@/components/events/event-feed";
import { CircleCard } from "./circle-card";
import { BulletinSection } from "./bulletin-section";
import { TasksSection } from "./tasks-section";
import { InviteModal } from "./invite-picker";
import { useAppState } from "@/components/providers/app-state-provider";
import { useTopBarMenu } from "@/components/providers/top-bar-action-provider";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { CIRCLE_TYPE_LABEL, circleCanHoldMeetings, circleChildren, circleContact, circleHasTasks, circleWebsiteUrl, isCircleAudience, isGroup, type CircleSection } from "@/lib/circles.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Circle, CircleInvitation, CircleResource, CircleTask, Event, Member } from "@/lib/types";
import { mapsPlatform, mapsUrl, type MapsPlatform } from "@/lib/maps.util";
import { isPhoneWidth } from "@/lib/viewport";
import { ProposalBanner } from "./proposal-banner";

interface CirclePageProps {
  circle: Circle;
  // which of its sections this is (the top bar's tab row switches them)
  section: CircleSection;
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
  // a task as a page (a phone; desktop gets a dialog): a new one, or one to edit
  onAddTaskPage: () => void;
  onOpenTaskPage: (task: CircleTask) => void;
  // inviting people as a page (a phone; desktop gets a dialog), and an invitation's own page
  onInvitePage: () => void;
  onOpenInvitation: (invitation: CircleInvitation) => void;
  // open this section's form as it shows (asked for from another section),
  // and going to another section, to open its form there
  startNew: boolean;
  onGoToSection: (section: CircleSection, opts?: { startNew?: boolean }) => void;
}

/* One section of a circle's page, the top bar's tab row switching between
   them: its bulletin, tasks, wiki (where its masthead is: what it is, where
   it sits and who last edited it, over its quick facts), members or events.
   Its open proposals head every section. */
export function CirclePage({ circle: c, section, isMember, lastEditor, lastEditedAt, events, onOpenMember, onOpenCircle, onOpenEvent, onNewEvent, onAddResourcePage, onEditResourcePage, onAddTaskPage, onOpenTaskPage, onInvitePage, onOpenInvitation, startNew, onGoToSection }: CirclePageProps) {
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
  const hasTasks = circleHasTasks(c);
  const websiteUrl = c.website ? circleWebsiteUrl(c.website) : null;
  const contact = c.contact ? circleContact(c.contact) : null;
  /* Posting on the bulletin and adding a task are in the top bar's menu, so
     whether their dialogs are open is kept here. On a phone each is a page
     of its own; on desktop a dialog over its section, so from another one it
     goes there first, which opens it as it shows (startNew). */
  const [adding, setAdding] = useState(section === "bulletin" && startNew);
  const startAdding = () => (isPhoneWidth() ? onAddResourcePage() : section === "bulletin" ? setAdding(true) : onGoToSection("bulletin", { startNew: true }));
  const [addingTask, setAddingTask] = useState(section === "tasks" && startNew);
  const startAddingTask = () => (isPhoneWidth() ? onAddTaskPage() : section === "tasks" ? setAddingTask(true) : onGoToSection("tasks", { startNew: true }));
  // the ?new=1 that asked for it goes once it's open, so Back or a reload
  // doesn't open it again
  useEffect(() => {
    if (startNew) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [startNew]);
  const [inviting, setInviting] = useState(false);
  const startInviting = () => (isPhoneWidth() ? onInvitePage() : setInviting(true));
  // this circle's invitations not yet accepted
  const invited = invitations.filter((i) => i.circleId === c.id);

  /* The top bar's menu, for a member: managing it, and adding to it, from
     whichever section is showing. Nothing to anyone else, who has nothing
     here to do. */
  useTopBarMenu(
    isMember
      ? [
          { label: "Manage circle", href: `/circles/${c.id}/manage`, icon: Cog6ToothIcon },
          { label: "Post on bulletin", icon: PlusIcon, onSelect: startAdding },
          ...(hasTasks ? [{ label: "New task", icon: CheckCircleIcon, onSelect: startAddingTask }] : []),
          { label: "Invite", icon: UserPlusIcon, onSelect: startInviting },
          { label: "New event", icon: CalendarIcon, onSelect: onNewEvent },
          // a meeting of this circle, where it can hold one (not a group)
          ...(circleCanHoldMeetings(c) ? [{ label: "New meeting", href: `/events/new?kind=meeting&circle=${c.id}`, icon: UserGroupIcon }] : []),
        ]
      : null,
  );

  return (
    <PageContainer size="normal">
      {openProposals.length > 0 && (
        <div className="mb-2 flex flex-col gap-3">
          {openProposals.map((p) => <ProposalBanner key={p.id} proposal={p} memberId={profile.id} />)}
        </div>
      )}

      {section === "bulletin" && (
        <SectionGroup>
          <Section className="pt-0">
            <BulletinSection circleId={c.id} adding={adding} onAdd={startAdding} onAddingDone={() => setAdding(false)} onEditPage={onEditResourcePage} />
          </Section>
        </SectionGroup>
      )}

      {section === "tasks" && (
        <SectionGroup>
          <Section className="pt-0">
            <TasksSection circle={c} adding={addingTask} onAdd={startAddingTask} onAddingDone={() => setAddingTask(false)} onOpenPage={onOpenTaskPage} />
          </Section>
        </SectionGroup>
      )}

      {section === "wiki" && (
        <>
          <CircleMasthead circle={c} parent={parent} lastEditor={lastEditor} lastEditedAt={lastEditedAt} onOpenMember={onOpenMember} onOpenCircle={onOpenCircle} ruled={c.facts.length === 0} />
          {/* its quick facts right under it, as a small table: each fact's
              own label is its heading. Before the sections rather than one of
              them, since it ends on its own ink rule and needs no hairline
              after it */}
          {c.facts.length > 0 && (
            <div className="grid grid-cols-2 gap-px border-y border-ink bg-faint min-[720px]:grid-cols-4">
              {c.facts.map(([k, v]) => (
                <div key={k} className="bg-paper px-4 py-4">
                  <Eyebrow className="text-soft">{k}</Eyebrow>
                  <div className="mt-2 font-sans text-lg font-extrabold tracking-snug">{v}</div>
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

            {/* where to find it online, in person and to get in touch: a
                square each, opening its website, its address in the visitor's
                maps app, or an email or a call to it */}
            {(c.website || c.address || c.contact) && (
              <Section>
                <div className="flex flex-wrap gap-3 min-[720px]:gap-x-10 min-[720px]:gap-y-4">
                  {websiteUrl ? (
                    <VisitLink
                      href={websiteUrl.href}
                      newTab
                      icon={GlobeAltIcon}
                      tone="action"
                      label="Website"
                      value={websiteUrl.hostname.replace(/^www\./, "")}
                    />
                  ) : c.website ? (
                    // not an address it can link to (an Instagram handle, say),
                    // so shown as typed rather than dropped
                    <div className="min-w-0">
                      <Eyebrow className="text-soft">Website</Eyebrow>
                      <div className="mt-1 font-serif text-base leading-[1.35] wrap-break-word text-body">{c.website}</div>
                    </div>
                  ) : null}
                  {c.address && <MapsLink address={c.address} />}
                  {contact ? (
                    <VisitLink
                      href={contact.href}
                      newTab={false}
                      icon={contact.kind === "email" ? EnvelopeIcon : PhoneIcon}
                      tone={contact.kind}
                      label={contact.kind === "email" ? "Email" : "Phone"}
                      value={contact.display}
                    />
                  ) : c.contact ? (
                    // not an email or a number, so shown as typed
                    <div className="min-w-0">
                      <Eyebrow className="text-soft">Get in touch</Eyebrow>
                      <div className="mt-1 font-serif text-base leading-[1.35] wrap-break-word text-body">{c.contact}</div>
                    </div>
                  ) : null}
                </div>
              </Section>
            )}

            {c.hours && c.hours.length > 0 && (
              <Section>
                <EyebrowGroup label="Open hours">
                  <div className="max-w-90">
                    {c.hours.map(([d, t]) => (
                      <div key={d} className="flex justify-between gap-3 border-b border-faint py-2 font-serif text-base text-body last:border-b-0">
                        <span className="text-soft">{d}</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </EyebrowGroup>
              </Section>
            )}

            {c.join && (
              <Section>
                <EyebrowGroup label="How to join">
                  <p className="max-w-[40em] font-serif text-base leading-normal text-body">{c.join}</p>
                </EyebrowGroup>
              </Section>
            )}
          </SectionGroup>
        </>
      )}

      {section === "members" && (
        <SectionGroup>
          <Section className="pt-0">
            {members.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] border-t border-l border-ink">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onOpenMember(m)}
                    className="ink-press flex cursor-pointer items-center gap-3 border-r border-b border-ink bg-paper p-4 text-left"
                  >
                    <Avatar member={m} size={44} />
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-bold">{m.name}</div>
                      <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{m.role}</span>
                      {/* everyone here belongs to this circle, so no neighborhood chip —
                          a role they hold in it takes that spot, as an outlined badge */}
                      {rolesHeldBy(c, m.id).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {rolesHeldBy(c, m.id).map((role) => (
                            <span
                              key={role}
                              title={`Role in ${c.name}`}
                              className="ink-press-badge inline-flex items-center whitespace-nowrap border border-ink bg-paper px-2 py-1 font-sans text-label font-bold uppercase tracking-caps text-ink"
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
              <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] border-t border-l border-ink">
                {invited.map((inv) => {
                  const m = memberById(inv.memberId);
                  const by = inv.invitedBy !== undefined ? memberById(inv.invitedBy) : undefined;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => onOpenInvitation(inv)}
                      className="ink-press flex cursor-pointer items-center gap-3 border-r border-b border-ink bg-paper p-4 text-left"
                    >
                      {m && <Avatar member={m} size={44} />}
                      <div className="min-w-0">
                        <div className="font-sans text-sm font-bold">{m?.name ?? "Someone"}{m?.id === profile.id && <span className="font-semibold text-soft"> (you)</span>}</div>
                        <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{by ? `Invited by ${by.id === profile.id ? "you" : by.name}` : "Invited"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </SectionGroup>
      )}

      {section === "events" && (
        <SectionGroup>
          <Section className="pt-0">
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

/* What the circle is, heading its wiki: its type, opposite its parent as a
   chip; its name and tagline; and who last edited it. Its quick facts follow
   right under it, their ink rule closing it; without any, it draws its own. */
function CircleMasthead({ circle: c, parent, lastEditor, lastEditedAt, onOpenMember, onOpenCircle, ruled }: { circle: Circle; parent: Circle | undefined; lastEditor: Member | null; lastEditedAt: string | undefined; onOpenMember: (m: Member) => void; onOpenCircle: (c: Circle) => void; ruled: boolean }) {
  return (
    <div className={clsx("pb-6", ruled && "border-b border-ink")}>
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
      <h1 className="mt-3 font-sans text-title leading-[0.92] font-extrabold tracking-display">{c.name}</h1>
      <p className="mt-4 font-serif text-xl text-body italic">{c.tagline}</p>
      {lastEditor && (
        <div className="mt-4 font-sans text-label tracking-open text-soft">
          Last edited by{" "}
          <button
            onClick={() => onOpenMember(lastEditor)}
            className="hit cursor-pointer border-none bg-transparent p-0 font-sans text-label font-bold tracking-open text-ink underline underline-offset-2"
          >
            {lastEditor.name}
          </button>
          {lastEditedAt ? ` · ${fmtEditDate(lastEditedAt)}` : ""}
        </div>
      )}
    </div>
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
      // its visible label first, so voice control can say "click Address"
      name={`Address: ${address}`}
    />
  );
}

const VISIT_TONE = {
  action: "border-action bg-action [--press-color:var(--color-action)]",
  leaf: "border-leaf bg-leaf [--press-color:var(--color-leaf)]",
  phone: "border-phone bg-phone [--press-color:var(--color-phone)]",
  email: "border-email bg-email [--press-color:var(--color-email)]",
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
      className="fill-press flex items-start gap-4 text-ink no-underline"
    >
      <span className={clsx("fill-press-square flex size-16 shrink-0 items-center justify-center border-2 text-paper", VISIT_TONE[tone])}>
        <Icon className="size-8" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="hidden min-w-0 min-[720px]:block" aria-hidden>
        <Eyebrow className="text-soft">{label}</Eyebrow>
        <div className="mt-1 font-serif text-base leading-[1.35] text-body">{value}</div>
      </div>
    </a>
  );
}
