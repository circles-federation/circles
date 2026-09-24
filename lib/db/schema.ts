import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { EventKindKey, NotificationKind } from "@/lib/types";

/* Drizzle table definitions — the only file besides lib/db/client.ts and
   lib/better-auth.ts that lib/db/*.ts may import from directly (see the
   wrapping rule in CLAUDE.md). Mirrors lib/types.ts; ids are never
   DB-generated because the app already assigns its own string ids at creation
   time (and never creates a Member).

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
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  bio: text("bio").notNull(),
  email: text("email").unique(),
});

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

/* A member's uploaded profile photo, in its own table so getMembers (which
   every page load runs) never reads the image bytes. There's deliberately no
   way to delete a row — a member can replace their photo but not remove it. */
export const memberPhotos = pgTable("member_photos", {
  memberId: integer("member_id")
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Everything that scopes something is a circle — see lib/types.ts. */
export const circleType = pgEnum("circle_type", ["neighborhood", "council", "collective", "cooperative", "other"]);

export const circles = pgTable(
  "circles",
  {
    id: text("id").primaryKey(),
    type: circleType("type").notNull(),
    name: text("name").notNull(),
    // self-referencing FK — the callback + explicit return type is Drizzle's
    // documented workaround for the otherwise-circular column type. Null only
    // for the root circle (the city); the unique partial index below makes
    // that the only such row.
    parentId: text("parent_id").references((): AnyPgColumn => circles.id),
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
  },
  (t) => [
    // target of circle_members' composite FK, which is what lets that table
    // enforce "one neighborhood per member" declaratively
    unique("circles_id_type_unique").on(t.id, t.type),
    uniqueIndex("circles_single_root").on(sql`(${t.parentId} is null)`).where(sql`${t.parentId} is null`),
  ]
);

/* Explicit membership for every circle, neighborhoods included — no derived
   rosters. circle_type is denormalized from circles via the composite FK, so
   the partial unique index can limit a member to one neighborhood circle
   without a trigger. */
export const circleMembers = pgTable(
  "circle_members",
  {
    circleId: text("circle_id").notNull(),
    circleType: circleType("circle_type").notNull(),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [
    primaryKey({ columns: [t.circleId, t.memberId] }),
    foreignKey({ columns: [t.circleId, t.circleType], foreignColumns: [circles.id, circles.type] }).onUpdate("cascade"),
    uniqueIndex("circle_members_one_neighborhood").on(t.memberId).where(sql`${t.circleType} = 'neighborhood'`),
  ]
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind").$type<EventKindKey>(),
    // every event belongs to exactly one circle — which decides who can see it
    // — and is organized by the member who created it
    circleId: text("circle_id").notNull().references(() => circles.id),
    // set when a circle hosts the event (the circle in circleId is then just who
    // it's shown to). The host circle's members vote on it first: until
    // approved_at is set it's a proposal only they can see. Approval is latched
    // — it stays set even if votes are later withdrawn or the roster changes.
    hostCircleId: text("host_circle_id").references(() => circles.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    organizerId: integer("organizer_id").notNull().references(() => members.id),
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
  },
  (t) => [
    // an event with no host circle is hosted by its organizer and is live
    // from the start; only a circle-hosted one can be awaiting approval
    check("events_live_or_proposed", sql`${t.hostCircleId} is not null or ${t.approvedAt} is not null`),
  ]
);

/* An email owed to a member about an event: one row per (event, member, kind),
   written in the same transaction as the event so an event is never created
   without its notifications queued (or queued without the event). A worker
   (lib/notify.ts) drains the unsent ones. `attempts`/`last_attempt_at` make a
   row claimable again only after a retry delay, which is also what stops two
   drains from sending the same email at once. Kept as a table of "who has
   already been told" rather than a generic outbox, so a later digest can skip
   what was already emailed individually. */
export const eventNotifications = pgTable(
  "event_notifications",
  {
    eventId: text("event_id").notNull().references(() => events.id),
    memberId: integer("member_id").notNull().references(() => members.id),
    kind: text("kind").$type<NotificationKind>().notNull().default("new"),
    // delivered as a line in the member's daily digest rather than an email of
    // its own — for circles too big to email about each event one at a time
    digest: boolean("digest").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.memberId, t.kind] }),
    index("event_notifications_pending_idx").on(t.createdAt).where(sql`${t.sentAt} is null`),
  ]
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    eventId: text("event_id").notNull().references(() => events.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.memberId] })]
);

// a meeting's votes toward quorum, or a circle-hosted event's approvals
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

/* Links a circle's members keep for themselves (a shared drive, a doc). Members-
   only: the app only ever loads these for circles the viewer belongs to (see
   lib/db/resources.ts). Deliberately a separate table, not a column on
   circles — the circles array is sent to every signed-in member. */
export const resourceIcon = pgEnum("resource_icon", ["folder", "file"]);

// A role a member holds in a circle (see lib/circle-roles.util.ts). A circle's
// rows are only ever rewritten as a whole, by lib/db/circle-roles.ts, so
// identity is the (case-insensitive) name and `position` is just display
// order. The built-in roles are written too once a circle saves its roles, but
// a circle with none saved still shows them, empty.
export const circleRoles = pgTable(
  "circle_roles",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    builtin: boolean("builtin").notNull().default(false),
    memberId: integer("member_id").references(() => members.id),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("circle_roles_circle_label_unique").on(t.circleId, sql`lower(${t.label})`)]
);

export const circleResources = pgTable(
  "circle_resources",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    icon: resourceIcon("icon").notNull(),
    // display order: resources are shown in the order they were added
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("circle_resources_circle_id_idx").on(t.circleId)]
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
