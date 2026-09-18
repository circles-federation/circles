import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { EventKindKey } from "@/lib/types";

/* Drizzle table definitions — the only file besides lib/db/client.ts and
   lib/better-auth.ts that lib/db/*.ts may import from directly (see the
   wrapping rule in the plan). Mirrors lib/types.ts field-for-field; ids are
   never DB-generated because the app never creates a Member or Org (only
   edits one), and already assigns its own string ids for Event/
   CouncilProposal at creation time.

   user/session/account/verification below are Better Auth's own tables —
   generated verbatim via `npx auth generate --adapter drizzle --dialect
   postgresql` against lib/better-auth.ts and reviewed before merging in,
   not hand-written. Deliberately disconnected from `members`: a Better Auth
   user is looked up by email (see lib/session.ts's getCurrentUserId), not by
   a foreign key, so this file doesn't have to know about auth internals and
   Better Auth doesn't have to know about the app's own member ids. */

export const members = pgTable("members", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  lastName: text("last_name"),
  pronouns: text("pronouns").notNull(),
  role: text("role").notNull(),
  neighborhood: text("neighborhood").notNull(),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  bio: text("bio").notNull(),
  email: text("email").unique(),
});

export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  // self-referencing FK — the callback + explicit return type is Drizzle's
  // documented workaround for the otherwise-circular column type
  parentId: text("parent_id").references((): AnyPgColumn => orgs.id),
  // set only on a Neighborhood Council — see lib/orgs.util.ts's orgMembers()
  neighborhood: text("neighborhood"),
  tagline: text("tagline").notNull(),
  about: text("about").notNull(),
  offers: text("offers").array().notNull().default(sql`'{}'::text[]`),
  lastEditedBy: integer("last_edited_by").references(() => members.id),
  lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
  facts: jsonb("facts").$type<[string, string][]>().notNull().default(sql`'[]'::jsonb`),
  join: text("join"),
  contact: text("contact"),
  website: text("website"),
  address: text("address"),
  hours: jsonb("hours").$type<[string, string][]>(),
});

// replaces Org.members: number[] — unused/empty for a Neighborhood Council,
// whose roster is derived (see orgMembers()), so this stays empty for those
export const orgMembers = pgTable(
  "org_members",
  {
    orgId: text("org_id").notNull().references(() => orgs.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.memberId] })]
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind").$type<EventKindKey>(),
    // Host discriminated union ({type:"member",id}|{type:"org",id}) as two
    // nullable FKs plus a check constraint — a standard SQL pattern for an
    // exclusive-or reference that a single polymorphic column can't express
    hostMemberId: integer("host_member_id").references(() => members.id),
    hostOrgId: text("host_org_id").references(() => orgs.id),
    // "YYYY-MM-DD"/"HH:MM" strings at the app boundary (see lib/format.util.ts) —
    // date/time mode:"string" keeps the DAL's row shape matching that exactly
    date: date("date", { mode: "string" }).notNull(),
    // time has no mode option — it's always a plain string (JS has no
    // time-only type to switch to). Postgres itself returns "HH:MM:SS";
    // the DAL below normalizes that to the app's "HH:MM" on read.
    start: time("start").notNull(),
    end: time("end").notNull(),
    location: text("location").notNull(),
    description: text("description").notNull(),
    membersOnly: boolean("members_only"),
    // meeting-only: the Council/org this meeting is hosted by/proposed for
    orgId: text("org_id").references(() => orgs.id),
    // meeting/council-only: governance votes toward quorum live in event_votes
    // council-only
    scope: text("scope").$type<"federation">(),
    sponsorId: text("sponsor_id"),
    sponsorName: text("sponsor_name"),
    sponsorNeighborhood: text("sponsor_neighborhood"),
    endorsements: text("endorsements").array(),
    // meeting-only: set when this meeting exists to endorse a pending council
    endorsesCouncilId: text("endorses_council_id"),
  },
  (t) => [check("event_host_exactly_one", sql`num_nonnulls(${t.hostMemberId}, ${t.hostOrgId}) = 1`)]
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    eventId: text("event_id").notNull().references(() => events.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.memberId] })]
);

export const eventVotes = pgTable(
  "event_votes",
  {
    eventId: text("event_id").notNull().references(() => events.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.memberId] })]
);

export const roles = pgTable(
  "roles",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    min: integer("min").notNull(),
    max: integer("max"),
  },
  (t) => [unique().on(t.eventId, t.key)]
);

export const roleMembers = pgTable(
  "role_members",
  {
    roleId: integer("role_id").notNull().references(() => roles.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.memberId] })]
);

export const councilProposals = pgTable("council_proposals", {
  id: text("id").primaryKey(),
  assemblyId: text("assembly_id").notNull().references(() => events.id),
  sponsorHood: text("sponsor_hood").notNull(),
  sponsorName: text("sponsor_name").notNull(),
  proposedBy: integer("proposed_by").notNull().references(() => members.id),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  start: time("start").notNull(),
  end: time("end").notNull(),
  location: text("location").notNull(),
  agenda: text("agenda").notNull(),
  ratified: boolean("ratified").notNull().default(false),
  councilId: text("council_id").references(() => events.id),
});

export const councilProposalRatifyVotes = pgTable(
  "council_proposal_ratify_votes",
  {
    proposalId: text("proposal_id").notNull().references(() => councilProposals.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.memberId] })]
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
