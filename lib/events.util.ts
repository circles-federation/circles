import type { CirclesById } from "./circles.util";
import type { Circle, Event, Member } from "./types";

// who to show as an event's host: the organizing member when a person
// organized it, otherwise the circle that hosts it collectively
export interface EventHost {
  label: string;
  circle: Circle | null;
  member: Member | null;
}

export function eventHost(e: Event, byId: CirclesById, memberById: (id: number) => Member | undefined): EventHost {
  if (e.organizerId != null) {
    const member = memberById(e.organizerId);
    if (member) return { label: member.name, circle: null, member };
  }
  const circle = byId[e.circleId] ?? null;
  return { label: circle?.name ?? "", circle, member: null };
}
