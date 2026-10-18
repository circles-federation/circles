"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CameraIcon } from "@heroicons/react/24/outline";
import { Avatar, Button } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Member } from "@/lib/types";

const PHOTO_SIZE = 512;

/* Crops to the centered square and scales down before upload, so a phone's
   multi-megabyte photo goes up as a ~50 KB JPEG — well inside the server's
   1 MB limit (setMemberPhoto in lib/db/members.ts) and the size every avatar
   is shown at anyway. Filled white first, since a transparent PNG would
   otherwise turn black as a JPEG. */
export async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
}

interface PhotoPickerProps {
  member: Member;
  // the chosen photo, ready to upload; saving it is the caller's job
  onChange: (photo: Blob) => void;
}

/* Choosing a replacement only — there's deliberately no way to remove a
   photo, here or on the server. Shows the chosen photo in place of the
   current one until the caller saves it. A new photo waits for a system
   admin's review before anyone else sees it (lib/db/photo-reviews.ts), so
   one already waiting shows here as it does on their profile, and choosing
   another replaces it; an admin's own goes up at once. */
export function PhotoPicker({ member, onChange }: PhotoPickerProps) {
  const { profile, pendingReviews } = useAppState();
  const isAdmin = pendingReviews !== null;
  const hint = isAdmin
    ? "Shown to neighbors who share a circle with you."
    : profile.pendingPhotoVersion
      ? "Your new photo is waiting for review. Until it's approved, others see your current one. Choosing another replaces it."
      : "Shown to neighbors who share a circle with you, once a Circles admin has checked it.";
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // cleared so choosing the same file again still fires a change
    e.target.value = "";
    if (!file) return;
    let photo: Blob;
    try {
      photo = await toSquareJpeg(file);
    } catch {
      setError("Couldn't read that image — try a JPEG or PNG.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(photo);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setError(null);
    onChange(photo);
  }

  return (
    <div className="flex items-center gap-4">
      {previewUrl ? (
        <img src={previewUrl} alt="" className="size-24 shrink-0 border border-ink object-cover" />
      ) : (
        <Avatar member={member} size={96} showPending />
      )}
      <div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <Button variant="secondary" size="compact" onClick={() => inputRef.current?.click()}>
          <CameraIcon className="size-4" strokeWidth={2} />
          Change photo
        </Button>
        {error ? (
          <p className="mt-2 font-sans text-xs font-bold text-danger">{error}</p>
        ) : (
          <p className="mt-2 font-serif text-sm leading-normal text-soft">{hint}</p>
        )}
      </div>
    </div>
  );
}
