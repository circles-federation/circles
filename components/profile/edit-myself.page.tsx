"use client";

import { useState } from "react";
import { EyeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { Button, ConfirmModal, Eyebrow, Label, PageContainer, Section, SectionGroup, TextArea } from "@/components/shared";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { EditableTags } from "./editable-tags";
import { PhotoPicker } from "./photo-picker";
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
  const [draft, setDraft] = useState<Profile>({ ...profile, skills: [...profile.skills], interests: [...profile.interests] });
  const set = (patch: Partial<Profile>) => setDraft((p) => ({ ...p, ...patch }));
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const dirty =
    photo !== null ||
    draft.bio !== profile.bio ||
    (draft.email || "") !== (profile.email || "") ||
    draft.emailPublic !== profile.emailPublic ||
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

  // the top bar's Back and the bottom Cancel button both leave the form, so
  // both get the same unsaved-changes guard
  useBackHandler(dirty ? () => setConfirmingDiscard(true) : null);
  function handleLeave() {
    if (dirty) setConfirmingDiscard(true);
    else onBack();
  }

  return (
    <PageContainer size="normal">
      <div className="border-t-[3px] border-t-ink border-b border-b-ink pt-4 pb-4.5">
        <Eyebrow className="text-soft">Edit</Eyebrow>
        <h1 className="mt-3 font-sans text-heading leading-none font-extrabold tracking-tight">Edit my details</h1>
      </div>

      <SectionGroup>
        <Section>
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

        {/* email + visibility */}
        <Section>
          <Label htmlFor="email">Email</Label>
          <div className="flex items-stretch border border-ink">
            <input
              id="email"
              value={draft.email || ""}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="you@duck.com"
              className="min-w-0 flex-1 border-none bg-paper px-3 py-2.75 font-serif text-base outline-none"
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
              : "Your email is private. Neighbors won't see a way to email you."}
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

      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button variant="secondary" onClick={handleLeave} disabled={saving}>Cancel</Button>
      </div>

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
