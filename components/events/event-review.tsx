import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { AgendaBadge } from "./agenda-section";
import { Avatar, Eyebrow } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { MONTHS, WEEKDAYS, fmtTime, parseDay } from "@/lib/format.util";
import type { AgendaCategory, Profile } from "@/lib/types";

export interface EventReviewProps {
  kindLabel: "Event" | "Meeting";
  title: string;
  date: string;
  start: string;
  end: string;
  repeats: string | null;
  location: string;
  description: string;
  agenda: { category: AgendaCategory; title: string; details?: string }[];
  roles: string[];
  reminders: string;
  // who sees it, and who it's from
  shownTo: string | null;
  host: Profile | { name: string };
  hostedByLabel: string;
  // what saving will do, said plainly; `proposing` makes it orange
  proposing: boolean;
  consequence: string;
  error: string;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4">
      <Eyebrow className="text-soft">{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/* The last look at a new event or meeting before it's created or proposed,
   with what saving will do to others said above it. Back returns to the form
   with the draft as it was. */
export function EventReview(p: EventReviewProps) {
  const day = parseDay(p.date);
  const dateLabel = p.date && !isNaN(day.getTime()) ? `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : "Date TBD";
  const host = "id" in p.host ? p.host : null;
  return (
    <div className="mx-auto flex max-w-170 flex-col gap-6">
      <div className={clsx("border-l-[3px] pl-3 font-serif text-sm leading-normal text-body", p.proposing ? "border-flame" : "border-leaf")}>
        <Eyebrow className={clsx("mb-1 block", p.proposing ? "text-flame-text" : "text-soft")}>
          {p.proposing ? "This will be proposed" : "Ready to create"}
        </Eyebrow>
        {p.consequence}
      </div>

      <div>
        <Eyebrow className="text-soft">{p.kindLabel}</Eyebrow>
        <h2 className="mt-1 font-sans text-3xl leading-tight font-extrabold tracking-display">{p.title}</h2>
      </div>

      <div className="grid grid-cols-1 border border-ink bg-paper min-[480px]:grid-cols-2">
        <div className="min-[480px]:border-r min-[480px]:border-ink">
          <Fact label="When">
            <div className="font-sans text-lg leading-snug font-extrabold tracking-snug">{dateLabel}</div>
            <div className="mt-0.5 font-serif text-sm text-soft">
              {fmtTime(p.start)}–{fmtTime(p.end)}
              {p.repeats && ` · ${p.repeats}`}
            </div>
          </Fact>
        </div>
        <div className="border-t border-ink min-[480px]:border-t-0">
          <Fact label="Where">
            <div className="font-sans text-lg leading-snug font-extrabold tracking-snug">{p.location}</div>
          </Fact>
        </div>
      </div>

      <div className="flex flex-col gap-4 border border-ink bg-paper px-4 py-4">
        {p.shownTo && (
          <div>
            <Eyebrow className="text-soft">Shown to</Eyebrow>
            <div className="mt-1 font-sans text-sm font-bold">{p.shownTo}</div>
          </div>
        )}
        <div>
          <Eyebrow className="text-soft">{p.hostedByLabel}</Eyebrow>
          <div className="mt-1 flex items-center gap-3">
            {host && <Avatar member={host} size={26} />}
            <span className="font-sans text-sm font-bold">{p.host.name}</span>
          </div>
        </div>
      </div>

      {p.kindLabel === "Event" && p.description && (
        <div>
          <Eyebrow className="text-soft">Details</Eyebrow>
          <p className="mt-2 font-serif text-base leading-normal whitespace-pre-line">{p.description}</p>
        </div>
      )}

      {p.agenda.length > 0 && (
        <div>
          <Eyebrow className="text-soft">Agenda</Eyebrow>
          <ol className="mt-2 flex flex-col gap-3">
            {p.agenda.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <AgendaBadge category={a.category} />
                <div>
                  <div className="font-sans text-sm font-bold">{a.title}</div>
                  <div className="font-serif text-sm text-soft">{AGENDA_CATEGORY[a.category].label}{a.details ? ` · ${a.details}` : ""}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {p.roles.length > 0 && (
        <div>
          <Eyebrow className="text-soft">Roles</Eyebrow>
          <p className="mt-2 font-serif text-base">{p.roles.join(", ")}</p>
        </div>
      )}

      <div>
        <Eyebrow className="text-soft">Reminders</Eyebrow>
        <p className="mt-2 font-serif text-base">{p.reminders}</p>
      </div>

      {p.error && (
        <div role="alert" className="flex items-start gap-2 border border-ink bg-tint-danger px-4 py-3 font-sans text-sm font-semibold text-on-action">
          <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          {p.error}
        </div>
      )}
    </div>
  );
}
