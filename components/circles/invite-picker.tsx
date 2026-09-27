"use client";

import { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Avatar, Button, Input, Modal } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { useCirclesById, useMembers } from "@/lib/hooks";
import type { Circle } from "@/lib/types";

// how much of a name has to be typed before anyone is listed
const MIN_QUERY = 3;

/* Choosing who to invite to a circle: a search, by name, of everyone on
   Circles who isn't in it — no one is listed until at least MIN_QUERY
   characters are typed, so the picker never opens on the whole roster. Those
   from the inviter's own neighborhood come first. Inviting is a tap on
   the person's row and is sent at once, so several can be invited in a row;
   someone already invited says so instead. Shown in a dialog on desktop
   (InviteModal) and as a page on a phone (InvitePage). */
export function InvitePicker({ circle }: { circle: Circle }) {
  const { profile, invitations, inviteToCircle } = useAppState();
  const members = useMembers();
  const byId = useCirclesById();
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState<number | null>(null);
  const [error, setError] = useState("");

  const invited = new Set(invitations.filter((i) => i.circleId === circle.id).map((i) => i.memberId));
  const q = query.trim().toLowerCase();
  const searching = q.length >= MIN_QUERY;
  const candidates = !searching ? [] : members
    .filter((m) => !circle.members.includes(m.id))
    .filter((m) => m.name.toLowerCase().includes(q))
    .sort((a, b) => Number(b.homeCircleId === profile.homeCircleId) - Number(a.homeCircleId === profile.homeCircleId) || a.name.localeCompare(b.name));

  async function invite(memberId: number) {
    setSending(memberId);
    setError("");
    const result = await inviteToCircle(circle.id, memberId);
    setSending(null);
    if (!result.ok) setError(result.error);
  }

  return (
    <div>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-soft" strokeWidth={2.5} />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search by name" autoFocus className="pl-9" />
      </div>
      {error && <p className="mt-2 font-sans text-xs font-bold text-danger">{error}</p>}
      <div className="mt-4 border-t border-ink">
        {!searching ? (
          <p className="py-4 font-serif text-base text-soft">Type at least {MIN_QUERY} letters of someone&apos;s name to find them.</p>
        ) : candidates.length === 0 ? (
          <p className="py-4 font-serif text-base text-soft">No one by that name who isn&apos;t already in {circle.name}.</p>
        ) : (
          candidates.map((m) => {
            const home = m.homeCircleId ? byId[m.homeCircleId] : undefined;
            return (
              <div key={m.id} className="flex items-center gap-3 border-b border-faint py-3">
                <Avatar member={m} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-sans text-sm font-bold">{m.name}</div>
                  {home && <div className="truncate font-serif text-sm text-soft">{home.name}</div>}
                </div>
                {invited.has(m.id) ? (
                  <span className="shrink-0 font-sans text-label font-bold tracking-[0.08em] text-soft uppercase">Invited</span>
                ) : (
                  <Button size="compact" variant="secondary" onClick={() => invite(m.id)} disabled={sending !== null} className="shrink-0">
                    {sending === m.id ? "Inviting…" : "Invite"}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// the desktop shell
export function InviteModal({ circle, onClose }: { circle: Circle; onClose: () => void }) {
  return (
    <Modal onClose={onClose} className="max-w-110" title={`Invite to ${circle.name}`}>
      <div className="px-4.5 py-5">
        <InvitePicker circle={circle} />
      </div>
    </Modal>
  );
}
