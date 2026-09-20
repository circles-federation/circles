"use server";

import * as circles from "./circles";
import * as events from "./events";
import * as members from "./members";
import type { Circle, Event, Member } from "@/lib/types";

/* AppStateProvider is a Client Component and can't hold a real DB
   connection — Drizzle's Postgres driver is Node-only. These thin wrappers
   are the boundary it calls through instead, the same "use server" pattern
   lib/auth.ts already uses. Reads don't need this: app/(app)/layout.tsx is
   already a Server Component and imports lib/db/*.ts directly. */

export async function updateMemberAction(id: number, patch: Partial<Member>) {
  return members.updateMember(id, patch);
}

export async function updateCircleAction(id: string, patch: Partial<Circle>) {
  return circles.updateCircle(id, patch);
}

export async function createEventAction(ev: Event) {
  return events.createEvent(ev);
}

export async function updateEventAction(id: string, patch: Partial<Event>) {
  return events.updateEvent(id, patch);
}
