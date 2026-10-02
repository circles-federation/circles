"use client";

import { useState } from "react";
import { CheckIcon, EyeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { ConfirmModal, Label, PageContainer, Section, SectionGroup, TextArea } from "@/components/shared";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { EditableTags } from "./editable-tags";
import { LanguagesEditor } from "./languages-editor";
import { PhotoPicker } from "./photo-picker";
import { BIRTH_DECADES, birthDecadeLabel } from "@/lib/members.util";
import type { Profile } from "@/lib/types";

interface EditMyselfPageProps {
  profile: Profile;
  onSave: (next: Profile) => void;
  onSavePhoto: (photo: Blob) => Promise<MutationResult>;
  onBack: () => void;
}

/* Edit Myself — the editing form, reached from the Myself page's Edit button.
   Saves back to the profile and returns to the view. */
export function EditMyselfPage({ profile, onSave, onSavePhoto, onBack }: EditMyselfPageProps) {
  const [draft, setDraft] = useState<Profile>({ ...profile, skills: [...profile.skills], interests: [...profile.interests], languages: [...(profile.languages ?? [])] });
  const set = (patch: Partial<Profile>) => setDraft((p) => ({ ...p, ...patch }));
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const dirty =
    photo !== null ||
    draft.bio !== profile.bio ||
    (draft.email || "") !== (profile.email || "") ||
    draft.emailPublic !== profile.emailPublic ||
    draft.birthDecade !== profile.birthDecade ||
    JSON.stringify(draft.languages ?? []) !== JSON.stringify(profile.languages ?? []) ||
    draft.skills.join(" ") !== profile.skills.join(" ") ||
    draft.interests.join(" ") !== profile.interests.join(" ");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // the photo goes first and is awaited: if the server refuses it, nothing
  // else has been saved yet and the form stays open to say why
  async function handleSave() {
    if (photo) {
      setSaving(true);
      const result = await onSavePhoto(photo);
      setSaving(false);
      if (!result.ok) {
        setPhotoError(result.error);
        return;
      }
    }
    onSave(draft);
    onBack();
  }

  // leaving is the top bar's Back, which asks before discarding changes
  useBackHandler(dirty ? () => setConfirmingDiscard(true) : null);
  // saving is the top bar's check, disabled until there's a change
  useTopBarAction({ label: saving ? "Saving" : "Save changes", icon: CheckIcon, onAction: handleSave, disabled: !dirty || saving, variant: "primary" });

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the first section starts where any page's content does, with
            the top bar's title (Edit profile) as the page's only heading */}
        <Section className="pt-0">
          <Label>Photo</Label>
          <PhotoPicker
            member={profile}
            onChange={(p) => {
              setPhoto(p);
              setPhotoError(null);
            }}
          />
          {photoError && <p className="mt-2.5 font-sans text-xs font-bold text-danger">{photoError}</p>}
        </Section>

        {/* bio */}
        <Section>
          <Label htmlFor="bio">Bio</Label>
          <TextArea id="bio" value={draft.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} />
        </Section>

        {/* the decade, not a birthdate — a tap each, or say nothing */}
        <Section>
          <Label>Born in the</Label>
          <div role="radiogroup" aria-label="Born in the" className="flex flex-wrap gap-2">
            {[undefined, ...BIRTH_DECADES].map((decade) => {
              const chosen = draft.birthDecade === decade;
              return (
                <button
                  key={decade ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => set({ birthDecade: decade })}
                  className={clsx(
                    "ink-press cursor-pointer border border-ink px-3.5 py-2 font-sans text-sm font-extrabold",
                    chosen ? "bg-ink text-paper" : "bg-paper text-ink",
                    decade === undefined && "font-bold text-soft",
                    decade === undefined && chosen && "text-paper",
                  )}
                >
                  {decade === undefined ? "Rather not say" : birthDecadeLabel(decade)}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 font-serif text-sm leading-normal text-soft">Just the decade, never a birthdate. It shows on your profile.</p>
        </Section>

        <Section>
          <Label>Languages</Label>
          <LanguagesEditor value={draft.languages ?? []} onChange={(languages) => set({ languages })} />
          <p className="mt-2.5 font-serif text-sm leading-normal text-soft">Tap a bar to say how well you speak each one, from beginner to native.</p>
        </Section>

        {/* email + visibility */}
        <Section>
          <Label htmlFor="email">Email</Label>
          <div className="flex items-stretch border border-ink">
            {/* read-only: it's also what they sign in with (lib/session.ts finds
                their member by it), so changing it here would lock them out */}
            <input
              id="email"
              value={draft.email || ""}
              readOnly
              aria-readonly="true"
              className="min-w-0 flex-1 cursor-default border-none bg-faint/40 px-3 py-2.75 font-serif text-base text-soft outline-none"
            />
            <div className="flex items-stretch border-l border-ink">
              <button
                onClick={() => set({ emailPublic: true })}
                className={clsx(
                  "ink-press inline-flex cursor-pointer items-center gap-1.5 border-r border-ink px-3.5 font-sans text-eyebrow font-bold tracking-[0.06em] whitespace-nowrap uppercase",
                  draft.emailPublic ? "bg-ink text-paper" : "bg-paper text-ink",
                )}
                title="Visible to neighbors"
              >
                <EyeIcon className="size-3.5" strokeWidth={2.5} />
                <span className="hidden min-[720px]:inline">Visible</span>
              </button>
              <button
                onClick={() => set({ emailPublic: false })}
                className={clsx(
                  "ink-press inline-flex cursor-pointer items-center gap-1.5 px-3.5 font-sans text-eyebrow font-bold tracking-[0.06em] whitespace-nowrap uppercase",
                  !draft.emailPublic ? "bg-ink text-paper" : "bg-paper text-ink",
                )}
                title="Hidden from other members"
              >
                <LockClosedIcon className="size-3.5" strokeWidth={2.5} />
                <span className="hidden min-[720px]:inline">Hidden</span>
              </button>
            </div>
          </div>
          <p className="mt-2.5 font-serif text-sm leading-normal text-soft">
            {draft.emailPublic
              ? "Your email is shown here so neighbors can reach you directly."
              : "Your email is private. Neighbors won't see a way to email you."}{" "}
            It&apos;s also how you sign in, so it can&apos;t be changed here.
          </p>
        </Section>

        {/* skills */}
        <Section>
          <Label>Skills I offer</Label>
          <EditableTags values={draft.skills} onChange={(v) => set({ skills: v })} placeholder="Add a skill and press Enter" />
        </Section>

        {/* interests */}
        <Section>
          <Label>Interests</Label>
          <EditableTags values={draft.interests} onChange={(v) => set({ interests: v })} placeholder="Add an interest and press Enter" />
        </Section>
      </SectionGroup>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to your profile. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
