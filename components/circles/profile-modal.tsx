"use client";

import { useEffect } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Avatar, Chip, Eyebrow, EyebrowGroup, Tag } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { CIRCLE_TYPE_LABEL, circlesForMember } from "@/lib/circles.util";
import { useCirclesById } from "@/lib/hooks";
import type { Circle, Member } from "@/lib/types";

interface ProfileModalProps {
  member: Member;
  onClose: () => void;
  onOpenCircle: (c: Circle) => void;
}

export function ProfileModal({ member: m, onClose, onOpenCircle }: ProfileModalProps) {
  const { profile, circles } = useAppState();
  const byId = useCirclesById();
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // the neighborhood has its own section above, so it isn't repeated here
  const memberCircles = circlesForMember(m.id, circles).filter((c) => c.type !== "neighborhood");
  const home = m.homeCircleId ? byId[m.homeCircleId] : undefined;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-ink/55 px-5 pt-15"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-140 border border-ink bg-paper shadow-[8px_8px_0_rgba(10,10,10,1)]"
      >
        <div className="flex items-center justify-between border-b border-ink px-4.5 py-3">
          <Eyebrow className="text-soft">Profile</Eyebrow>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent font-sans text-lg font-bold leading-none">✕</button>
        </div>

        <div className="flex gap-5 border-b border-faint p-5.5">
          <Avatar member={m} size={110} />
          <div>
            <h2 className="font-sans text-heading leading-[0.95] font-extrabold tracking-tight">{m.name}</h2>
            <p className="mt-1.5 font-sans text-eyebrow tracking-[0.04em] text-soft">{m.pronouns}</p>
            <div className="mt-2.5"><Tag filled>{m.role}</Tag></div>
          </div>
        </div>

        <div className="flex flex-col gap-5.5 p-5.5">
          <p className="font-serif text-lg leading-normal">{m.bio}</p>

          {m.email && (
            <EyebrowGroup label="Get in touch">
              <a
                href={`mailto:${m.email}`}
                className="inline-flex items-center gap-2 border border-ink px-3.25 py-2.25 font-sans text-sm font-bold break-all text-ink"
              >
                <span className="text-eyebrow">✉</span>
                {m.email}
              </a>
            </EyebrowGroup>
          )}

          <EyebrowGroup label="Skills offered">
            {m.skills.map((s) => <Tag key={s}>{s}</Tag>)}
          </EyebrowGroup>

          <EyebrowGroup label="Interests">
            {m.interests.map((s) => <Tag key={s}>{s}</Tag>)}
          </EyebrowGroup>

          {home && (
            <EyebrowGroup label="Neighborhood">
              <div className="flex flex-wrap gap-0">
                <Chip title={m.homeCircleId === profile.homeCircleId ? "This neighborhood" : "Another neighborhood in the federation"}>{home.name}</Chip>
              </div>
            </EyebrowGroup>
          )}

          {memberCircles.length > 0 && (
            <EyebrowGroup label="Member of">
              <div className="border-t border-ink">
                {memberCircles.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenCircle(c)}
                    className="flex w-full cursor-pointer items-baseline justify-between border-0 border-b border-faint bg-paper py-3 text-left"
                  >
                    <span className="font-sans text-sm font-bold">{c.name}</span>
                    <Eyebrow className="inline-flex items-center gap-1 text-soft">
                      {CIRCLE_TYPE_LABEL[c.type]}
                      {/* strokeWidth is in viewBox units, not px — smaller than the
                          usual size-3.5/strokeWidth-2.5 pair, so the width is scaled
                          up (2.5 * 14/10) to keep the stroke the same physical thickness */}
                      <ArrowRightIcon className="size-2.5" strokeWidth={3.5} />
                    </Eyebrow>
                  </button>
                ))}
              </div>
            </EyebrowGroup>
          )}
        </div>
      </div>
    </div>
  );
}
