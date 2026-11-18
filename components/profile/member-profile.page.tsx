"use client";

import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Avatar, Eyebrow, EyebrowGroup, FolderGrid, CappedChip, PageContainer, Tag, MastheadGlow } from "@/components/shared";
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
    <PageContainer size="wide">
      <div className="relative isolate pt-4 pb-6">
        <MastheadGlow />
        <div className="flex items-center justify-between gap-3 min-[960px]:justify-start min-[960px]:gap-4">
          {/* as they wrote them, not in small caps */}
          <span className="shrink-0 font-sans text-sm font-semibold text-soft">{m.pronouns}</span>
          {home && (
            <CappedChip title={m.homeCircleId === profile.homeCircleId ? "Your neighborhood" : "Their neighborhood"} onClick={() => onOpenCircle(home)}>
              {home.name}
            </CappedChip>
          )}
        </div>
        <div className="mt-4 flex items-center gap-5 min-[960px]:items-end min-[960px]:gap-8">
          {/* the decade is a tilted sticker laid over the photo's corner */}
          <div className="relative shrink-0">
            <div className="min-[960px]:hidden">
              <Avatar member={m} size={96} showPending />
            </div>
            <div className="hidden min-[960px]:block">
              <Avatar member={m} size={176} showPending />
            </div>
            {m.birthDecade !== undefined && (
              <span className="absolute -bottom-3 -left-3 -rotate-6 border border-ink bg-action px-2.5 pt-1 pb-0.5 text-center text-on-action shadow-float">
                <span className="block font-sans text-label leading-none font-bold tracking-caps uppercase">Born in the</span>
                <span className="block font-sans text-xl leading-tight font-extrabold tracking-[-0.03em]">{birthDecadeLabel(m.birthDecade)}</span>
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-sans text-title leading-[0.92] font-extrabold tracking-display min-[960px]:text-[64px] min-[960px]:leading-[1.02]">{m.name}</h1>
            {/* as a member card shows it, under the name in sentence case (it's
                information, not a label), a size up for the larger name; a new
                member may not have filled it in yet */}
            {m.role && <p className="mt-2 font-serif text-lg leading-snug text-soft">{m.role}</p>}
          </div>
        </div>
        {m.bio && <p className="mt-5 font-serif text-xl text-body italic">{m.bio}</p>}
      </div>

      {/* two columns from 960px: languages, skills and interests on the left,
          how to get in touch and the circles they're in on the right; on a
          phone one run (`order` over `contents` columns), apart by space */}
      <div className="mt-8 flex flex-col gap-10 min-[960px]:grid min-[960px]:grid-cols-2 min-[960px]:items-start min-[960px]:gap-x-12">
        <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
        {m.languages && m.languages.length > 0 && (
          <section className="order-1">
            <EyebrowGroup label="Languages">
              <div className="border border-ink bg-paper px-4">
                {m.languages.map((l) => {
                  const endonym = languageEndonym(l.code);
                  const english = languageName(l.code);
                  return (
                    <div key={l.code} className="flex items-center gap-4 border-b border-ink py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-sans text-lg leading-tight font-extrabold tracking-snug">{endonym}</div>
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
          </section>
        )}

        {(m.skills.length > 0 || m.interests.length > 0) && (
          <section className="order-3 flex flex-col gap-6">
            {m.skills.length > 0 && (
              <EyebrowGroup label="Skills">
                {m.skills.map((s) => <Tag key={s}>{s}</Tag>)}
              </EyebrowGroup>
            )}
            {m.interests.length > 0 && (
              <EyebrowGroup label="Interests">
                {m.interests.map((s) => <Tag key={s}>{s}</Tag>)}
              </EyebrowGroup>
            )}
          </section>
        )}

        </div>
        <div className="contents min-[960px]:flex min-[960px]:flex-col min-[960px]:gap-10">
        {ownHidden ? (
          <section className="order-2">
            <EyebrowGroup label="Get in touch">
              <p className="inline-flex items-center gap-2 font-serif text-base text-soft">
                <LockClosedIcon className="size-4 shrink-0" strokeWidth={2} />
                Your email is hidden from other members.
              </p>
            </EyebrowGroup>
          </section>
        ) : m.email && (
          <section className="order-2">
            <EyebrowGroup label="Get in touch">
              <a
                href={`mailto:${m.email}`}
                className="ink-press flex min-h-11 items-center gap-3 border border-ink bg-paper px-4 py-3 font-sans text-sm font-bold break-all text-ink"
              >
                <span className="flex size-8 shrink-0 items-center justify-center border border-ink bg-email text-on-action">
                  <EnvelopeIcon className="size-4" strokeWidth={2} />
                </span>
                {m.email}
              </a>
            </EyebrowGroup>
          </section>
        )}

        {memberCircles.length > 0 && (
          <section className="order-4">
            <FolderGrid
              label="Member of"
              items={memberCircles}
              minWidth={300}
              renderItem={(c) => <CircleCard key={c.id} c={c} onOpenCircle={onOpenCircle} showKindEyebrow />}
            />
          </section>
        )}
        </div>
      </div>
    </PageContainer>
  );
}
