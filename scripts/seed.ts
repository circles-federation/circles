import { CIRCLES, EVENTS, MEMBERS } from "@/lib/data";
import { db } from "@/lib/db/client";
import { createEvent } from "@/lib/db/events";
import { circleMembers, circles as circlesTable, members as membersTable, user as userTable } from "@/lib/db/schema";

/* One-time local dev setup — inserts today's seed fixtures into a fresh
   Postgres database (after `npx drizzle-kit migrate`):

     npx tsx --env-file=.env.local scripts/seed.ts

   Exempt from the "no file outside lib/db/ imports Drizzle directly" rule —
   that rule is about app runtime code, not one-off setup tooling. Reuses
   lib/db/events.ts's createEvent() for events (it already knows how to fan
   an Event out across events/event_rsvps/event_votes/roles/role_members);
   members/circles have no equivalent "create" DAL function (the app only
   ever edits one), so those go straight through the Drizzle client. */
async function seed() {
  console.log(`Seeding ${MEMBERS.length} members...`);
  await db.insert(membersTable).values(
    MEMBERS.map((m) => ({
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

  console.log(`Seeding ${CIRCLES.length} circles...`);
  // parents are referenced in the same statement — Postgres checks FKs at the
  // end of a multi-row insert, so order within CIRCLES doesn't matter
  await db.insert(circlesTable).values(
    CIRCLES.map((c) => ({
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
  const membershipRows = CIRCLES.flatMap((c) => c.members.map((memberId) => ({ circleId: c.id, circleType: c.type, memberId })));
  if (membershipRows.length > 0) await db.insert(circleMembers).values(membershipRows);

  console.log(`Seeding ${EVENTS.length} events...`);
  for (const e of EVENTS) await createEvent(e);

  // Better Auth's own user table, one row per member who has an email — the
  // email-otp plugin is configured with disableSignUp:true (see
  // lib/better-auth.ts), so an email with no matching row here can never
  // sign in. A member with no email was never able to log in under the old
  // mock auth either, so that's unchanged, not a regression. id is inserted
  // directly (not via Better Auth's own API — there's no password to hash
  // and this is a one-time bulk seed, not a real sign-up flow); the app
  // never reads this id — lib/session.ts looks a session's user back up by
  // email, deliberately decoupled from lib/db's own member ids.
  const withEmail = MEMBERS.filter((m) => m.email);
  console.log(`Seeding ${withEmail.length} Better Auth users...`);
  await db.insert(userTable).values(
    withEmail.map((m) => ({
      id: "user_" + m.id,
      name: m.name,
      email: m.email!,
      emailVerified: true,
    }))
  );

  console.log("Done.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
