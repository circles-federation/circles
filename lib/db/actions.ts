"use server";

import * as circles from "./circles";
import * as events from "./events";
import * as members from "./members";
import * as resources from "./resources";
import { getCurrentUserId } from "@/lib/session";
import type { ResourceInput } from "@/lib/resources.util";
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

/* Resource writes are the app's first server-side authorization: they act as
   the signed-in member from the session (never a client-supplied id), and
   lib/db/resources.ts checks that member belongs to the circle. They return a
   result object instead of throwing — Next sanitizes a thrown error's message
   in production, so the caller couldn't show why it was refused (same shape
   lib/auth.ts's actions use). */
async function asMember<T>(run: (memberId: number) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const memberId = await getCurrentUserId();
  if (!memberId) return { ok: false, error: "Sign in again to do that." };
  try {
    return { ok: true, value: await run(memberId) };
  } catch (err) {
    if (err instanceof resources.ResourceError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong — try again." };
  }
}

export async function createResourceAction(circleId: string, input: ResourceInput) {
  return asMember((memberId) => resources.createResource(memberId, circleId, input));
}

export async function updateResourceAction(id: string, input: ResourceInput) {
  return asMember((memberId) => resources.updateResource(memberId, id, input));
}

export async function deleteResourceAction(id: string) {
  return asMember((memberId) => resources.deleteResource(memberId, id));
}
