import type { AgendaCategory, AgendaItem } from "./types";

/* A meeting's agenda is a list of items, each marked with Sociocracy's R/E/D:
   what the circle is meant to do with it. Knowing that up front is what lets
   a facilitator run the meeting to time — a report needs no discussion, an
   exploration ends without a decision, and a decision is where the circle's
   consent is asked for. Pure, and shared by the form (instant feedback) and
   lib/db/events.ts (the real check). */

export const AGENDA_CATEGORIES: AgendaCategory[] = ["report", "explore", "decide"];

export const AGENDA_CATEGORY: Record<AgendaCategory, { letter: string; label: string; hint: string }> = {
  report: { letter: "R", label: "Report", hint: "Sharing information. Questions to clarify, but no discussion." },
  explore: { letter: "E", label: "Explore", hint: "Discussing and gathering ideas. No decision yet." },
  decide: { letter: "D", label: "Decide", hint: "Making a decision together, by consent." },
};

export const AGENDA_TITLE_MAX = 120;
export const AGENDA_DETAILS_MAX = 1000;
export const MAX_AGENDA_ITEMS = 30;

// the first problem with a meeting's agenda, or null when it's fine
export function validateAgenda(items: AgendaItem[]): string | null {
  if (items.length === 0) return "Add at least one agenda topic.";
  if (items.length > MAX_AGENDA_ITEMS) return `Keep the agenda to ${MAX_AGENDA_ITEMS} topics or fewer.`;
  for (const [i, item] of items.entries()) {
    const title = item.title.trim();
    if (!AGENDA_CATEGORIES.includes(item.category)) return `Agenda topic ${i + 1}: pick Report, Explore or Decide.`;
    if (!title) return `Give agenda topic ${i + 1} a title, or remove it.`;
    if (title.length > AGENDA_TITLE_MAX) return `Agenda topic ${i + 1}: keep the title under ${AGENDA_TITLE_MAX} characters.`;
    if ((item.details ?? "").length > AGENDA_DETAILS_MAX) return `Agenda topic ${i + 1}: keep the details under ${AGENDA_DETAILS_MAX} characters.`;
  }
  return null;
}

// the first problem with one topic added to a meeting under way, or null
export function validateAgendaItem(item: AgendaItem): string | null {
  const title = item.title.trim();
  if (!AGENDA_CATEGORIES.includes(item.category)) return "Pick Report, Explore or Decide.";
  if (!title) return "Give the topic a title.";
  if (title.length > AGENDA_TITLE_MAX) return `Keep the title under ${AGENDA_TITLE_MAX} characters.`;
  if ((item.details ?? "").length > AGENDA_DETAILS_MAX) return `Keep the details under ${AGENDA_DETAILS_MAX} characters.`;
  return null;
}
