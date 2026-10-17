"use client";

import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Avatar, Eyebrow, EyebrowGroup, FolderGrid, MastheadChip, PageContainer, Section, SectionGroup, Tag } from "@/components/shared";
import { CircleCard } from "@/components/circles/circle-card";
import { useAppState } from "@/components/providers/app-state-provider";
import { circlesForMember } from "@/lib/circles.util";
import { birthDecadeLabel } from "@/lib/members.util";
import { LANGUAGE_LEVELS, languageEndonym, languageName } from "@/lib/languages.util";
import { LanguageLevelBar } from "./language-level";
import { useCirclesById } from "@/lib/hooks";
import type { Circle, Member } from "@/lib/types";

interface MemberProfilePageProps {
  member: Member;
  onOpenCircle: (c: Circle) => void;
}

/* A member's profile, laid out like a circle page: a masthead (their home
   neighborhood as its chip, where a circle has its parent), then sections.
   Editing your own is the top bar's pencil. */
export function MemberProfilePage({ member: m, onOpenCircle }: MemberProfilePageProps) {
  const { profile, circles } = useAppState();
  const byId = useCirclesById();
  // the neighborhood is the masthead's chip, so it isn't repeated in the grid
  const memberCircles = circlesForMember(m.id, circles).filter((c) => c.type !== "neighborhood");
  const home = m.homeCircleId ? byId[m.homeCircleId] : undefined;
  // you're still sent your own email when it's hidden, but this page is your
  // profile as others see it, so it isn't shown here either
  const ownHidden = m.id === profile.id && !profile.emailPublic;

  return (
    <PageContainer size="normal">
      <div className="border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-5.5">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow className="shrink-0 text-soft">{m.pronouns}</Eyebrow>
          {home && (
            <MastheadChip title={m.homeCircleId === profile.homeCircleId ? "Your neighborhood" : "Their neighborhood"} onClick={() => onOpenCircle(home)}>
              {home.name}
            </MastheadChip>
          )}
        </div>
        <div className="mt-4 flex items-center gap-5">
          <Avatar member={m} size={96} />
          <div className="min-w-0">
            <h1 className="font-sans text-title leading-[0.92] font-extrabold tracking-[-0.035em]">{m.name}</h1>
            {/* a new member may not have filled it in yet */}
            {m.role && <div className="mt-3"><Tag filled>{m.role}</Tag></div>}
          </div>
        </div>
        {m.bio && <p className="mt-4.5 font-serif text-xl text-[#222] italic">{m.bio}</p>}
      </div>

      <SectionGroup>
        {/* the playful one: the decade as a big, tilted sticker */}
        {m.birthDecade !== undefined && (
          <Section>
            <EyebrowGroup label="Born in the">
              <span className="inline-block -rotate-3 bg-ink px-4 pt-2 pb-1.5 font-sans text-title leading-none font-extrabold tracking-[-0.04em] text-paper">
                {birthDecadeLabel(m.birthDecade)}
              </span>
            </EyebrowGroup>
          </Section>
        )}

        {m.languages && m.languages.length > 0 && (
          <Section>
            <EyebrowGroup label="Languages">
              <div className="border-t border-ink">
                {m.languages.map((l) => {
                  const endonym = languageEndonym(l.code);
                  const english = languageName(l.code);
                  return (
                    <div key={l.code} className="flex items-center gap-4 border-b border-faint py-3 last:border-b-ink">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-sans text-lg leading-tight font-extrabold tracking-[-0.01em]">{endonym}</div>
                        {/* always a second line, so every row is the same height: the
                            English name where it differs, and the level's word */}
                        <div className="truncate font-serif text-sm text-soft">
                          {endonym === english ? LANGUAGE_LEVELS[l.level] : `${english} · ${LANGUAGE_LEVELS[l.level]}`}
                        </div>
                      </div>
                      <LanguageLevelBar level={l.level} language={english} />
                    </div>
                  );
                })}
              </div>
            </EyebrowGroup>
          </Section>
        )}

        {ownHidden ? (
          <Section>
            <EyebrowGroup label="Get in touch">
              <p className="inline-flex items-center gap-2 font-serif text-base text-soft">
                <LockClosedIcon className="size-4 shrink-0" strokeWidth={2} />
                Your email is hidden from other members.
              </p>
            </EyebrowGroup>
          </Section>
        ) : m.email && (
          <Section>
            <EyebrowGroup label="Get in touch">
              <a
                href={`mailto:${m.email}`}
                className="ink-press inline-flex min-h-11 items-center gap-2 border border-ink px-3.25 py-2.25 font-sans text-sm font-bold break-all text-ink"
              >
                <EnvelopeIcon className="size-4 shrink-0" strokeWidth={2} />
                {m.email}
              </a>
            </EyebrowGroup>
          </Section>
        )}

        {(m.skills.length > 0 || m.interests.length > 0) && (
          <Section className="flex flex-col gap-5.5">
            {m.skills.length > 0 && (
              <EyebrowGroup label="Skills offered">
                {m.skills.map((s) => <Tag key={s}>{s}</Tag>)}
              </EyebrowGroup>
            )}
            {m.interests.length > 0 && (
              <EyebrowGroup label="Interests">
                {m.interests.map((s) => <Tag key={s}>{s}</Tag>)}
              </EyebrowGroup>
            )}
          </Section>
        )}

        {memberCircles.length > 0 && (
          <Section>
            <FolderGrid
              label="Member of"
              items={memberCircles}
              minWidth={300}
              renderItem={(c) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showKindEyebrow />}
            />
          </Section>
        )}
      </SectionGroup>
    </PageContainer>
  );
}
