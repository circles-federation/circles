import { ArrowTopRightOnSquareIcon, PencilIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Avatar, BackButton, Button, Chip, Eyebrow, EyebrowGroup, PageContainer, Section, SectionGroup, Tag } from "@/components/shared";
import { GovernanceRow } from "@/components/events/governance-row";
import { OrdinaryRow } from "@/components/events/ordinary-row";
import { OrgCard } from "./org-card";
import { useAppState } from "@/components/providers/app-state-provider";
import { fmtEditDate, parseDay } from "@/lib/format.util";
import { kindOf } from "@/lib/governance.util";
import { useMemberById, useMembers } from "@/lib/hooks";
import { orgChildren, orgMembers, orgScope } from "@/lib/orgs.util";
import type { Event, Member, Org } from "@/lib/types";

interface OrgPageProps {
  org: Org;
  isMember: boolean;
  lastEditor: Member | null;
  lastEditedAt?: string;
  events: Event[];
  onBack: () => void;
  backLabel?: string;
  onOpenMember: (m: Member) => void;
  onOpenOrg: (o: Org) => void;
  onOpenEvent: (e: Event) => void;
  onManage: () => void;
}

export function OrgPage({ org: o, isMember, lastEditor, lastEditedAt, events, onBack, backLabel, onOpenMember, onOpenOrg, onOpenEvent, onManage }: OrgPageProps) {
  const { profile, orgs } = useAppState();
  const allMembers = useMembers();
  const memberById = useMemberById();
  const orgsById = orgs.reduce<Record<string, Org>>((acc, org) => { acc[org.id] = org; return acc; }, {});
  const scope = orgScope(o, orgsById);
  const members = orgMembers(o, allMembers).map(memberById).filter((m): m is Member => Boolean(m));
  const childOrgs = orgChildren(o, orgs);
  // events convened by this org, soonest first (location is irrelevant)
  const hostedEvents = [...events]
    .filter((e) => e.host.type === "org" && e.host.id === o.id)
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());

  return (
    <PageContainer size="normal">
      <BackButton onClick={onBack}>{backLabel || "All organizations"}</BackButton>

      <div className="mt-4 flex flex-col items-stretch gap-4.5 border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <Eyebrow className="text-soft">{o.kind}</Eyebrow>
            {scope !== null && (
              <Chip title={scope === profile.neighborhood ? "Local to this neighborhood" : "Across the federation"}>{scope}</Chip>
            )}
          </div>
          <h1 className="mt-3 font-sans text-title leading-[0.92] font-extrabold tracking-[-0.035em]">{o.name}</h1>
          <p className="mt-3.5 font-serif text-xl text-[#222] italic">{o.tagline}</p>
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
        {o.facts.map(([k, v]) => (
          <div key={k} className="bg-paper py-4 px-3.5">
            <Eyebrow className="text-soft">{k}</Eyebrow>
            <div className="mt-2 font-sans text-lg font-extrabold tracking-[-0.01em]">{v}</div>
          </div>
        ))}
      </div>

      <SectionGroup>
        <Section>
          <EyebrowGroup label="About">
            <p className="max-w-[40em] font-serif text-lg leading-[1.55]">{o.about}</p>
          </EyebrowGroup>
        </Section>

        <Section>
          <EyebrowGroup label="What they offer">
            {o.offers.map((s) => <Tag key={s}>{s}</Tag>)}
          </EyebrowGroup>
        </Section>

        <Section>
          <Eyebrow className="text-soft">Events they host</Eyebrow>
          {/* no border of its own on either branch (unlike the grids below),
              so the header rule lives here instead, on the wrapper */}
          <div className="mt-4 border-t border-ink">
            {hostedEvents.length > 0 ? (
              <div className="pt-1">
                {hostedEvents.map((e) => (
                  kindOf(e).governance
                    ? <GovernanceRow key={e.id} e={e} onOpenEvent={onOpenEvent} />
                    : <OrdinaryRow key={e.id} e={e} onOpenEvent={onOpenEvent} />
                ))}
              </div>
            ) : (
              <p className="pt-4 font-serif text-base text-soft">
                No upcoming events hosted by {o.name}.
              </p>
            )}
          </div>
        </Section>

        {childOrgs.length > 0 && (
          <Section>
            <Eyebrow className="text-soft">Sub-organizations</Eyebrow>
            {/* the grid's own border-t is the header rule — same as Members below */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] border-t border-l border-ink">
              {childOrgs.map((child) => (
                <OrgCard key={child.id} o={child} onOpenOrg={onOpenOrg} showScopeChip={false} />
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
                    <div className="mt-1.5">
                      <Chip title={`Neighborhood: ${m.neighborhood}`}>{m.neighborhood}</Chip>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 font-serif text-base text-soft">
              No members of {o.name} are listed here yet.
            </p>
          )}
        </Section>

        {(o.website || o.address || (o.hours && o.hours.length > 0)) && (
          <Section>
            <Eyebrow className="text-soft">Visit</Eyebrow>
            {/* the box's own border is the header rule here, fainter than the
                ink one above since it's framing a box rather than a card grid */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] border border-faint">
              <div className="border-r border-b border-faint px-4.5 py-4">
                <Eyebrow className="text-soft">Website</Eyebrow>
                <div className="mt-2">
                  {o.website
                    ? (
                      <a
                        href={`https://${o.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-sans text-sm font-bold text-ink underline underline-offset-2 break-all"
                      >
                        {o.website}
                        <ArrowTopRightOnSquareIcon className="size-3.5" strokeWidth={2.5} />
                      </a>
                    )
                    : <span className="font-serif text-sm text-soft">—</span>}
                </div>
              </div>
              <div className="border-r border-b border-faint px-4.5 py-4">
                <Eyebrow className="text-soft">Address</Eyebrow>
                <div className="mt-2">
                  {o.address
                    ? o.address.split(",").map((line, i) => (
                        <div key={i} className="font-serif text-sm leading-[1.4] text-[#222]">{line.trim()}</div>
                      ))
                    : <span className="font-serif text-sm text-soft">—</span>}
                </div>
              </div>
              <div className="border-b border-faint px-4.5 py-4">
                <Eyebrow className="text-soft">Open hours</Eyebrow>
                <div className="mt-2">
                  {o.hours && o.hours.length > 0
                    ? o.hours.map(([d, t]) => (
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
            <p className="mt-3 font-serif text-base leading-normal">{o.join}</p>
          </div>
          <div className="bg-ink p-6 text-paper">
            <Eyebrow className="text-[#bdbdbd]">Get in touch</Eyebrow>
            <p className="mt-3 font-sans text-lg font-bold wrap-break-word">{o.contact}</p>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
