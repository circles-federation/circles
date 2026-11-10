"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAppState } from "@/components/providers/app-state-provider";
import { Avatar, Eyebrow } from "@/components/shared";
import { clockMinutes, minutesClock } from "@/lib/availability.util";
import { meetingAvailabilityAction } from "@/lib/db/actions";
import { isClock, isDay } from "@/lib/events.util";
import { fmtTime } from "@/lib/format.util";
import type { Member, MeetingAvailability as Availability } from "@/lib/types";

interface MeetingAvailabilityProps {
  circleId: string;
  date: string;
  start: string;
  end: string;
  // the meeting being edited, which doesn't clash with itself
  eventId?: string;
}

// set apart from the fields around it, since it's an answer, not a field
const BOX = "bg-wash p-4";

type Answer = { key: string; result: Availability } | { key: string; error: string };

/* Who in the meeting's circle can make the date and time chosen above, from
   what each member set in Settings → Meeting availability: Available, Not
   available (and until when they're free, for someone free as it begins), and
   Unknown for someone who hasn't set it. The server answers for that one time
   only (meetingAvailabilityAction), so no one's schedule reaches this form.
   Names aren't links: leaving the form would discard what's been typed. */
export function MeetingAvailability({ circleId, date, start, end, eventId }: MeetingAvailabilityProps) {
  const { profile, members } = useAppState();
  const [answer, setAnswer] = useState<Answer | null>(null);

  const ready = !!circleId && isDay(date) && isClock(start) && isClock(end);
  // a meeting that runs past midnight can't be judged against one day's windows
  const overnight = ready && clockMinutes(end) <= clockMinutes(start);
  const key = `${circleId}|${date}|${start}|${end}|${eventId ?? ""}`;

  // asked a moment after the last change, and an answer that's since been
  // overtaken by a newer question is dropped
  useEffect(() => {
    if (!ready || overnight) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await meetingAvailabilityAction(circleId, date, start, end, eventId).catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
      if (!stale) setAnswer(result.ok ? { key, result: result.value } : { key, error: result.error });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [ready, overnight, circleId, date, start, end, eventId, key]);

  if (!ready) return null;
  if (overnight) return <div className={BOX}><p className="font-serif text-sm leading-[1.45] text-soft">Who&rsquo;s available isn&rsquo;t checked for a meeting that runs past midnight.</p></div>;

  // what's shown while the next answer comes is the last one, dimmed
  const settled = answer?.key === key;
  const nameOf = (id: number): { member: Member; label: string } | null => {
    const member = id === profile.id ? profile : members.find((m) => m.id === id);
    return member ? { member, label: id === profile.id ? `${member.name} (you)` : member.name } : null;
  };
  const people = (ids: number[]) => ids.map(nameOf).filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className={BOX}>
      <Eyebrow className="text-soft">Who can make it</Eyebrow>
      {answer === null && <p className="mt-3 font-serif text-sm text-soft">Checking…</p>}
      {answer && "error" in answer && <p className="mt-3 font-serif text-sm text-soft">{answer.error}</p>}
      {answer && "result" in answer && <Result result={answer.result} dimmed={!settled} people={people} />}
    </div>
  );
}

function Result({ result, dimmed, people }: { result: Availability; dimmed: boolean; people: (ids: number[]) => { member: Member; label: string }[] }) {
  const total = result.available.length + result.unavailable.length + result.unknown.length;
  return (
    <div className={clsx("mt-3 transition-opacity", dimmed && "opacity-50")} aria-live="polite">
      <p className="font-sans text-base font-bold">
        {result.available.length} of {total} available
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <Group title="Available" rule="border-leaf" entries={people(result.available)} />
        <Group
          title="Not available"
          rule="border-soft"
          entries={people(result.unavailable.map((u) => u.id)).map((p) => {
            const u = result.unavailable.find((x) => x.id === p.member.id);
            if (u?.busy) return { ...p, note: "has another event" };
            return u?.freeUntil === undefined ? p : { ...p, note: `free until ${fmtTime(minutesClock(u.freeUntil))}` };
          })}
        />
        <Group title="Unknown" rule="border-soft" hint="Haven't set when they can do meetings." entries={people(result.unknown)} />
      </div>
    </div>
  );
}

function Group({ title, rule, hint, entries }: { title: string; rule: string; hint?: string; entries: { member: Member; label: string; note?: string }[] }) {
  if (entries.length === 0) return null;
  return (
    <div className={clsx("border-l-[3px] pl-3", rule)}>
      <div className="font-sans text-eyebrow font-bold uppercase tracking-caps text-soft">
        {title} · {entries.length}
      </div>
      {hint && <p className="mt-0.5 font-serif text-sm leading-snug text-soft">{hint}</p>}
      {/* four across once there's room for a name beside each photo, two on a phone */}
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 min-[560px]:grid-cols-4">
        {entries.map(({ member, label, note }) => (
          <li key={member.id} title={note ? `${label} · ${note}` : label} className="flex min-w-0 items-center gap-2">
            <Avatar member={member} size={30} />
            <span className="min-w-0 flex-1 font-serif text-sm leading-tight">
              <span className="block truncate">{label}</span>
              {note && <span className="block truncate text-xs text-soft">{note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
