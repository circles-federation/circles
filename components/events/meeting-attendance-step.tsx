"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { GuestAvatar } from "./guest-avatar";
import { Avatar, Badge, Button, Eyebrow, Input } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { validateGuestAttendee } from "@/lib/meeting-session.util";
import type { Circle, MeetingSession } from "@/lib/types";

/* Who's there. Anyone marks themself; the facilitator marks the rest, and
   writes in anyone without an account by name and email (not verified: if that
   address ever joins, their photo shows in place of the placeholder). */
export function MeetingAttendanceStep({
  session,
  circle,
  memberId,
  onSetPresent,
  onAddGuest,
  onRemoveGuest,
}: {
  session: MeetingSession;
  circle: Circle;
  memberId: number;
  onSetPresent: (targetId: number, present: boolean) => void;
  onAddGuest: (input: { name: string; email: string }) => Promise<boolean>;
  onRemoveGuest: (guestId: string) => void;
}) {
  const { members } = useAppState();
  const people = circle.members.map((id) => members.find((m) => m.id === id)).filter((m) => m !== undefined);
  const facilitating = session.facilitatorId === memberId;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const addGuest = async () => {
    setBusy(true);
    const ok = await onAddGuest({ name, email });
    setBusy(false);
    if (ok) {
      setName("");
      setEmail("");
    }
  };
  return (
    <div>
      <Eyebrow>Who’s here · {session.attendees.length + session.guests.length}</Eyebrow>
      <p className="mt-2 font-serif text-base text-soft">{facilitating ? "Tap a name to mark someone here or not." : "Tap your name to say you’re here. The facilitator marks everyone else."}</p>
      <ul className="m-0 mt-4 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,248px),1fr))] gap-0 border-t border-l border-ink p-0">
        {people.map((m) => {
          const here = session.attendees.includes(m.id);
          const mine = m.id === memberId;
          return (
            <li key={m.id} className="contents">
              <button
                type="button"
                disabled={!mine && !facilitating}
                aria-pressed={here}
                onClick={() => onSetPresent(m.id, !here)}
                className={clsx("flex items-center gap-3 border-0 border-r border-b border-ink p-4 text-left", here ? "bg-wash" : "bg-paper", mine || facilitating ? "ink-press cursor-pointer" : "cursor-default")}
              >
                <Avatar member={m} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-sans text-sm font-bold">
                    {m.name}
                    {mine ? " (you)" : ""}
                    {m.id === session.facilitatorId && <Badge variant="action">Facilitator</Badge>}
                  </span>
                  <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">{here ? "Here" : "Not here"}</span>
                </span>
                {here && (
                  <span className="flex size-6 shrink-0 items-center justify-center border border-ink bg-tint-leaf text-on-action">
                    <CheckIcon className="size-4" strokeWidth={2.5} aria-hidden />
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {session.guests.map((g) => (
          <li key={g.id} className="flex items-center gap-3 border-r border-b border-ink bg-wash p-4">
            <GuestAvatar eventId={session.eventId} guest={g} />
            <span className="min-w-0 flex-1">
              <span className="block font-sans text-sm font-bold">{g.name}</span>
              <span className="mt-0.5 block font-serif text-sm leading-snug text-soft">Guest</span>
            </span>
            {facilitating && session.status === "live" && (
              <button type="button" aria-label={`Remove ${g.name}`} onClick={() => onRemoveGuest(g.id)} className="hit ink-press flex size-8 shrink-0 cursor-pointer items-center justify-center border border-ink bg-paper">
                <XMarkIcon className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {facilitating && (
        <form
          className="mt-8"
          onSubmit={(ev) => {
            ev.preventDefault();
            void addGuest();
          }}
        >
          <Eyebrow>Someone without an account</Eyebrow>
          <p className="mt-2 font-serif text-base text-soft">Write them in by first name and email. We keep only the first name, and don’t check the address; it’s only used to show their photo if they join Circles with it later.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input aria-label="Guest first name" placeholder="First name" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="off" />
            <Input aria-label="Guest email" type="email" placeholder="Email" value={email} onChange={(ev) => setEmail(ev.target.value)} autoComplete="off" />
          </div>
          <div className="mt-3">
            <Button type="submit" size="compact" disabled={busy || validateGuestAttendee({ name, email }) !== null}>
              Add guest
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
