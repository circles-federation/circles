import clsx from "clsx";
import { Eyebrow, EyebrowGroup } from "@/components/shared";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import type { AgendaCategory, AgendaItem, Event } from "@/lib/types";

/* A meeting's agenda, as a board of cards like a circle's bulletin (see
   BulletinCard): each ruled along its top in the agenda's turquoise and headed
   by its R/E/D category, so what the circle is meant to do with each item —
   hear it, talk it through, or decide it — reads at a glance. Numbered, since
   it's run in order. */
export function AgendaSection({ event: e }: { event: Event }) {
  const items = e.agenda ?? [];
  return (
    <section className="border-b border-faint py-8">
      <EyebrowGroup label="Agenda">
        {items.length === 0 ? (
          <p className="font-serif text-lg text-soft">No agenda yet.</p>
        ) : (
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-4">
            {items.map((item, i) => (
              <AgendaCard key={i} item={item} number={i + 1} />
            ))}
          </ol>
        )}
      </EyebrowGroup>
    </section>
  );
}

function AgendaCard({ item, number }: { item: AgendaItem; number: number }) {
  return (
    <li className="flex flex-col border border-t-[3px] border-ink border-t-agenda bg-paper p-4">
      <div className="flex items-center gap-2">
        <AgendaBadge category={item.category} />
        <Eyebrow className="min-w-0 flex-1 truncate text-agenda">{AGENDA_CATEGORY[item.category].label}</Eyebrow>
        <span className="font-sans text-eyebrow font-bold text-soft tabular-nums" aria-label={`Topic ${number}`}>{number}</span>
      </div>
      <div className="mt-3 font-sans text-base leading-tight font-bold wrap-anywhere">{item.title}</div>
      {item.details && <p className="mt-2 font-serif text-sm leading-normal whitespace-pre-line text-body">{item.details}</p>}
    </li>
  );
}

// the category's letter in a solid turquoise square — R, E or D — or, when
// `outline`, the same square unfilled (the form's unchosen options)
export function AgendaBadge({ category, outline = false }: { category: AgendaCategory; outline?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-flex size-6 shrink-0 items-center justify-center border border-agenda font-sans text-sm font-extrabold",
        // ink-press-badge: on a pressed (inked) choice it stays paper with an ink letter
        outline ? "ink-press-badge bg-paper text-agenda" : "bg-agenda text-paper",
      )}
    >
      {AGENDA_CATEGORY[category].letter}
    </span>
  );
}
