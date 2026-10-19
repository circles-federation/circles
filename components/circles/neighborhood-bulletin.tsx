"use client";

import { useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { ConfirmModal, Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { postingCirclesFor } from "@/lib/circles.util";
import type { Circle, NeighborhoodPost } from "@/lib/types";
import { BulletinCard } from "./bulletin-section";

interface NeighborhoodBulletinProps {
  neighborhood: Circle;
  onPropose: () => void;
}

/* A neighborhood's bulletin: what the Circles inside it have posted for
   everyone who lives there, each consented to by its circle first. Only
   residents are ever sent its posts (and a posting circle's members, its
   own), so anyone else sees nothing here, not even that it exists. A member
   of one of its Circles can propose a post, and take one of their circle's
   down. */
export function NeighborhoodBulletin({ neighborhood, onPropose }: NeighborhoodBulletinProps) {
  const { neighborhoodPosts, circles, profile, removeNeighborhoodPost } = useAppState();
  const [removing, setRemoving] = useState<NeighborhoodPost | null>(null);
  const posts = neighborhoodPosts.filter((p) => p.neighborhoodId === neighborhood.id);
  const canPost = postingCirclesFor(profile.id, neighborhood, circles).length > 0;
  const circleName = (id: string) => circles.find((c) => c.id === id)?.name ?? "a former circle";
  const isMine = (p: NeighborhoodPost) => !!circles.find((c) => c.id === p.circleId)?.members.includes(profile.id);
  if (posts.length === 0 && !canPost) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow className="text-soft">Bulletin</Eyebrow>
        {canPost && posts.length > 0 && (
          <button
            type="button"
            onClick={onPropose}
            className="hit flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 font-sans text-xs font-bold tracking-caps text-ink uppercase"
          >
            <PlusIcon className="size-4" strokeWidth={2.5} aria-hidden />
            Propose a post
          </button>
        )}
      </div>
      {posts.length === 0 ? (
        // an empty board offers the first post, as a blank card to fill in
        <button
          type="button"
          onClick={onPropose}
          className="ink-press mt-4 flex w-full cursor-pointer flex-col items-center gap-1.5 border border-dashed border-soft bg-transparent px-6 py-7 text-center text-soft"
        >
          <PlusIcon className="size-6" strokeWidth={2} aria-hidden />
          <Eyebrow className="text-soft">Propose a post</Eyebrow>
          <span className="mt-1 font-serif text-base">Share an announcement or a link with everyone in {neighborhood.name}. Your circle consents to it first.</span>
        </button>
      ) : (
        // the same board as a circle's bulletin, each card saying which circle posted it
        <div className="mt-4 grid grid-flow-row-dense grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-4">
          {posts.map((p) => (
            <BulletinCard key={p.id} resource={p} from={circleName(p.circleId)} {...(isMine(p) ? { onRemove: () => setRemoving(p) } : {})} />
          ))}
        </div>
      )}

      {removing && (
        <ConfirmModal
          title="Take this post down?"
          message={`“${removing.title}” will be taken off ${neighborhood.name}'s bulletin for everyone.`}
          confirmLabel="Take down"
          cancelLabel="Keep it"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const id = removing.id;
            setRemoving(null);
            void removeNeighborhoodPost(id);
          }}
        />
      )}
    </div>
  );
}
