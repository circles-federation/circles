import { useEffect, useState } from "react";
import { ArrowUpTrayIcon, CalendarIcon, CheckCircleIcon, Cog6ToothIcon, PlusIcon, UserGroupIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { Avatar, Badge, EmptyState, Eyebrow, PageContainer, RingIcon, Section, SectionGroup, useToast } from "@/components/shared";
import { EventFeed } from "@/components/events/event-feed";
import { CircleCard } from "./circle-card";
import { CircleWiki } from "./circle-wiki";
import { BulletinSection } from "./bulletin-section";
import { TasksSection } from "./tasks-section";
import { InboxSection } from "./inbox-section";
import { InviteModal } from "./invite-picker";
import { useAppState } from "@/components/providers/app-state-provider";
import { useTopBarMenu } from "@/components/providers/top-bar-action-provider";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { rolesHeldBy } from "@/lib/circle-roles.util";
import { circleCanHoldMeetings, circleChildren, circleHasInbox, circleHasTasks, circleHasWiki, isCircleAudience, type CircleSection } from "@/lib/circles.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Circle, CircleInvitation, CircleResource, CircleTask, Event, Member } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";
import { shareOrCopy } from "@/lib/share";
import { ProposalBanner } from "./proposal-banner";
import { openProposalsFor } from "@/lib/proposals.util";

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
   them: its bulletin, tasks, inbox, decisions (its open proposals), wiki
   (where its masthead is: what it is, where it sits and who last edited it,
   over its quick facts), members or events. */
export function CirclePage({ circle: c, section, isMember, lastEditor, lastEditedAt, events, onOpenMember, onOpenCircle, onOpenEvent, onNewEvent, onAddResourcePage, onEditResourcePage, onAddTaskPage, onOpenTaskPage, onInvitePage, onOpenInvitation, startNew, onGoToSection }: CirclePageProps) {
  const { profile, circles, invitations, proposals } = useAppState();
  const { showToast } = useToast();
  // its open proposals: a change to the circle, and any events it's deciding
  const openProposals = openProposalsFor(proposals, c.id);
  const memberById = useMemberById();
  const members = c.members.map(memberById).filter((m): m is Member => Boolean(m));
  const childCircles = circleChildren(c, circles);
  // the circles inside this one whose delegate a member is
  const delegateFor = (memberId: number) => childCircles.filter((child) => child.roles?.some((r) => r.label === "Delegate" && r.memberId === memberId));
  const byId = useCirclesById();
  const parent = c.parentId !== null ? byId[c.parentId] : undefined;
  // events in this circle — shown to it, or hosted by it — soonest first (location is irrelevant)
  const circleEvents = [...events]
    .filter((e) => e.circleId === c.id || e.hostCircleId === c.id)
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());
  const hasTasks = circleHasTasks(c);
  // writing to it in the app: while its Inbox is on, for anyone outside it
  const canWrite = circleHasInbox(c) && !isMember;
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

  // its wiki's public page (/wiki/[id]), to send to anyone, on Circles or not
  async function shareWiki() {
    const how = await shareOrCopy({ title: c.name, text: c.tagline, url: `${window.location.origin}/wiki/${c.id}` });
    if (how === "copied") showToast({ tone: "success", title: "Link copied", message: `Anyone with it can read ${c.name}'s wiki, signed in or not.` });
    if (how === "failed") showToast({ tone: "error", message: "Couldn't copy the link. Your browser blocked it." });
  }

  /* The top bar's menu: for a member, managing it and adding to it, from
     whichever section is showing; for anyone, sharing its wiki (a group has
     none, and only its members know it exists). */
  useTopBarMenu([
    ...(isMember
      ? [
          { label: "Manage circle", href: `/circles/${c.id}/manage`, icon: Cog6ToothIcon },
          { label: "Post on bulletin", icon: PlusIcon, onSelect: startAdding },
          ...(hasTasks ? [{ label: "New task", icon: CheckCircleIcon, onSelect: startAddingTask }] : []),
          { label: "Invite", icon: UserPlusIcon, onSelect: startInviting },
          { label: "New event", icon: CalendarIcon, onSelect: onNewEvent },
          // a meeting of this circle, where it can hold one (not a group)
          ...(circleCanHoldMeetings(c) ? [{ label: "New meeting", href: `/events/new?kind=meeting&circle=${c.id}`, icon: UserGroupIcon }] : []),
        ]
      : []),
    ...(circleHasWiki(c) ? [{ label: "Share wiki", icon: ArrowUpTrayIcon, onSelect: () => void shareWiki() }] : []),
  ]);

  return (
    <PageContainer size="normal">
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

      {section === "decisions" && (
        <SectionGroup>
          <Section className="pt-0">
            {openProposals.length > 0 ? (
              <div className="flex flex-col gap-3">
                {openProposals.map((p) => (
                  <ProposalBanner key={p.id} proposal={p} memberId={profile.id} />
                ))}
              </div>
            ) : (
              <EmptyState>Nothing to decide right now. When someone proposes something for {c.name}, it&rsquo;s decided here.</EmptyState>
            )}
          </Section>
        </SectionGroup>
      )}

      {section === "inbox" && (
        <SectionGroup>
          <Section className="pt-0">
            <InboxSection circle={c} />
          </Section>
        </SectionGroup>
      )}

      {section === "wiki" && (
        <CircleWiki
          circle={c}
          {...(parent ? { parent: { name: parent.name, onOpen: () => onOpenCircle(parent) } } : {})}
          lastEdited={
            lastEditor && (
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
            )
          }
          {...(childCircles.length > 0 ? { subCircles: childCircles.map((child) => <CircleCard key={child.id} c={child} onOpenCircle={onOpenCircle} showNeighborhoodChip={false} showKindEyebrow={false} />) } : {})}
          {...(canWrite ? { writeHref: `/circles/${c.id}/write` } : {})}
        />
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
                          a role they hold in it takes that spot, as an outlined badge,
                          and being one of its circles' delegate, which is why
                          they're here, a quieter one */}
                      {(rolesHeldBy(c, m.id).length > 0 || delegateFor(m.id).length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {rolesHeldBy(c, m.id).map((role) => (
                            <Badge key={role} title={`Role in ${c.name}`}>
                              {role}
                            </Badge>
                          ))}
                          {delegateFor(m.id).map((child) => (
                            // the ring says it's a circle's delegate, so a long
                            // name can be cut short without losing what it means
                            <Badge key={child.id} variant="subtle" title={`${child.name}'s delegate to ${c.name}`}>
                              <RingIcon className="size-4 shrink-0" aria-hidden />
                              <span className="sr-only">Delegate for </span>
                              <span className="truncate">{child.name}</span>
                            </Badge>
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
