import { db } from "@/lib/db/client";
import { insertEvent } from "@/lib/db/events";
import { circleMembers, circleResources, circles as circlesTable, members as membersTable, user as userTable } from "@/lib/db/schema";
import type { Circle, CircleResource, Event, Member } from "@/lib/types";

/* The insert logic shared by every seed script (scripts/seed.ts for demo data,
   scripts/seed-beta.ts for the real beta cohort) — takes already-shaped
   fixtures and writes them into a freshly-migrated database.

   Exempt from the "no file outside lib/db/ imports Drizzle directly" rule —
   that rule is about app runtime code, not one-off setup tooling. Reuses
   lib/db/events.ts's insertEvent() for events (it already knows how to fan
   an Event out across events/event_rsvps/event_votes/roles/role_members);
   members/circles have no equivalent "create" DAL function (the app only
   ever edits one), so those go straight through the Drizzle client. */
export async function seedDatabase({ members, circles, events, resources = [] }: { members: Member[]; circles: Circle[]; events: Event[]; resources?: CircleResource[] }) {
  console.log(`Seeding ${members.length} members...`);
  await db.insert(membersTable).values(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      lastName: m.lastName ?? null,
      pronouns: m.pronouns,
      role: m.role,
      skills: m.skills,
      interests: m.interests,
      bio: m.bio,
      email: m.email ?? null,
    }))
  );

  console.log(`Seeding ${circles.length} circles...`);
  // parents are referenced in the same statement — Postgres checks FKs at the
  // end of a multi-row insert, so order within `circles` doesn't matter
  await db.insert(circlesTable).values(
    circles.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      parentId: c.parentId,
      tagline: c.tagline,
      about: c.about,
      offers: c.offers,
      lastEditedBy: c.lastEditedBy ?? null,
      lastEditedAt: c.lastEditedAt ? new Date(c.lastEditedAt) : null,
      facts: c.facts,
      join: c.join ?? null,
      contact: c.contact ?? null,
      website: c.website ?? null,
      address: c.address ?? null,
      hours: c.hours ?? null,
    }))
  );

  console.log("Seeding circle memberships...");
  const membershipRows = circles.flatMap((c) => c.members.map((memberId) => ({ circleId: c.id, circleType: c.type, memberId })));
  if (membershipRows.length > 0) await db.insert(circleMembers).values(membershipRows);

  console.log(`Seeding ${events.length} events...`);
  for (const e of events) await insertEvent(e);

  console.log(`Seeding ${resources.length} resources...`);
  // one insert each, in order: rows of a single statement all share one
  // created_at (now() is per-transaction), which would lose the display order
  for (const r of resources) await db.insert(circleResources).values(r);

  // Better Auth's own user table, one row per member who has an email — the
  // email-otp plugin is configured with disableSignUp:true (see
  // lib/better-auth.ts), so an email with no matching row here can never
  // sign in. id is inserted directly (not via Better Auth's own API — there's
  // no password to hash and this is a one-time bulk seed, not a real sign-up
  // flow); the app never reads this id — lib/session.ts looks a session's
  // user back up by email, deliberately decoupled from lib/db's own member
  // ids.
  const withEmail = members.filter((m) => m.email);
  console.log(`Seeding ${withEmail.length} Better Auth users...`);
  if (withEmail.length > 0) {
    await db.insert(userTable).values(
      withEmail.map((m) => ({
        id: "user_" + m.id,
        name: m.name,
        email: m.email!,
        emailVerified: true,
      }))
    );
  }
}
