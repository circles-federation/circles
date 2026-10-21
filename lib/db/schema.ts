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
import type { RoleDraft } from "@/lib/events.util";
import type {
  AgendaCategory,
  ConsentResponse,
  EventChange,
  EventKindKey,
  MemberLanguage,
  AvailabilityWindow,
  NotificationChannel,
  NotificationKind,
  ProposalChanges,
  ProposalKind,
  TaskPriority,
  TaskStatus,
  ProposalLine,
  ProposalNoticeKind,
  ProposalStatus,
  RepeatFrequency,
} from "@/lib/types";

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
  // generated for a member created by an approved application; the seed
  // scripts still insert their fixtures' own ids (and then move the sequence
  // past them — see scripts/seed-core.ts)
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  lastName: text("last_name"),
  pronouns: text("pronouns").notNull(),
  role: text("role").notNull(),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  bio: text("bio").notNull(),
  // the languages they speak and how well, in their own order
  languages: jsonb("languages").$type<MemberLanguage[]>().notNull().default(sql`'[]'::jsonb`),
  // when they can do meetings, as weekly windows; null until they've set it
  // (Unknown on the meeting form), [] once they've said they never can
  availability: jsonb("availability").$type<AvailabilityWindow[]>(),
  // the decade they were born in, as its first year (1990 for the '90s), if
  // they've chosen to say — never a birthdate
  birthDecade: integer("birth_decade"),
  email: text("email").unique(),
  // whether other members may see the email (Edit myself's Visible/Hidden);
  // when they may not, it's left out of what's sent to them (getMembersForViewer)
  emailPublic: boolean("email_public").notNull().default(false),
  // whether they're told about the app's goings-on (events, announcements,
  // invitations, the daily digest) by email, and by push on the devices
  // they've turned it on for — Settings → Notifications. Sign-in codes are
  // emailed regardless.
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  // a system admin: a worker of the foundation running the platform, who
  // reviews applications (see applications below). Set by `npm run admin`.
  isAdmin: boolean("is_admin").notNull().default(false),
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

/* A new photo a member has uploaded, waiting for a system admin to approve
   (see lib/db/photo-reviews.ts): at most one per member, a new upload
   replacing it. Until it's approved everyone else is shown the member_photos
   one; approving moves it there, declining deletes it. */
export const memberPendingPhotos = pgTable("member_pending_photos", {
  memberId: integer("member_id")
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

/* One row per device a member has turned push notifications on for (see
   lib/push/index.ts). The endpoint is the push service's address for that
   browser install, so it's the key: if someone else signs in on the same
   device, saving its subscription moves the row to them. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [index("push_subscriptions_member_idx").on(t.memberId)]
);

/* Everything that scopes something is a circle — see lib/types.ts. */
export const circleType = pgEnum("circle_type", ["neighborhood", "circle", "collective", "cooperative", "other", "group"]);

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
    needs: text("needs").array().notNull().default(sql`'{}'::text[]`),
    // a Circle's (type "circle") domain — the area it has the authority to
    // decide in — and its aims, what it's there to achieve, as sociocracy
    // defines a circle. Required of a Circle, decided by consent (see
    // lib/proposals.util.ts); not shown anywhere but Manage circle yet.
    domain: text("domain"),
    aims: text("aims").array().notNull().default(sql`'{}'::text[]`),
    lastEditedBy: integer("last_edited_by").references(() => members.id),
    lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
    facts: jsonb("facts").$type<[string, string][]>().notNull().default(sql`'[]'::jsonb`),
    join: text("join"),
    contact: text("contact"),
    website: text("website"),
    address: text("address"),
    hours: jsonb("hours").$type<[string, string][]>(),
    // set when its last member leaves (leaveCircle): it's kept, but hidden
    // from everyone — sent to no one, so its page 404s and it's in no list —
    // until there's a way to revive or delete it
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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

/* A repeating event: its pattern, and the template each of its dates is made
   from. Every date is an ordinary events row pointing back here, so RSVPs,
   votes, slots, cancelling and notifications all work per date unchanged.
   Dates are added a few weeks ahead (extendEventSeries in lib/db/events.ts),
   and generated_through is how far that's got — so a date that was deleted is
   never made again. A circle-hosted series gets no dates past its first until
   that first one is approved (approved_at, latched like an event's). */
export const eventSeries = pgTable(
  "event_series",
  {
    id: text("id").primaryKey(),
    frequency: text("frequency").$type<RepeatFrequency>().notNull(),
    // the first date, which the pattern is read from, and the last one allowed
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    until: date("until", { mode: "string" }),
    generatedThrough: date("generated_through", { mode: "string" }).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    title: text("title").notNull(),
    kind: text("kind").$type<EventKindKey>(),
    circleId: text("circle_id").notNull().references(() => circles.id),
    hostCircleId: text("host_circle_id").references(() => circles.id),
    organizerId: integer("organizer_id").notNull().references(() => members.id),
    // as on events: the role that approved it without a vote, for every date
    approvedByRole: text("approved_by_role"),
    start: time("start").notNull(),
    end: time("end").notNull(),
    location: text("location").notNull(),
    description: text("description").notNull(),
    // signup slot definitions, copied (empty) onto each new date
    roles: jsonb("roles").$type<RoleDraft[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [check("event_series_frequency", sql`${t.frequency} in ('weekly', 'monthly')`)]
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
    // the role's name when the organizer was the Leader, Secretary or
    // Facilitator of the circle that would have voted — a meeting's own, or the
    // host circle — so it was approved without a vote (a meeting like that is
    // attended by RSVP). Kept as it was even if they later lose the role.
    approvedByRole: text("approved_by_role"),
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
    // set when its organizer cancels it while others are going (one no one
    // else is going to is deleted instead). Final: a cancelled event stays
    // visible, labelled so, but takes no RSVPs, votes, signups or edits.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // cancelled by the app rather than its organizer: a required slot was
    // still short 15 minutes before the start (see checkUnfilledSlots)
    cancelledAutomatically: boolean("cancelled_automatically").notNull().default(false),
    // set once its host has been told a required slot is still short an hour
    // before the start (checkUnfilledSlots), so they're told once; cleared
    // when it's moved
    slotsWarnedAt: timestamp("slots_warned_at", { withTimezone: true }),
    // whether it's cancelled automatically if a required slot is still short
    // 15 minutes before the start. False for one created, or moved, to start
    // within the hour: whoever did that knows the slot's empty, and an event
    // made at 9:40 shouldn't vanish at 9:45. Its host is still warned.
    autoCancel: boolean("auto_cancel").notNull().default(true),
    // set once the people going have been queued a reminder, or when there's
    // nothing to remind them of: it was created, or moved, already within a
    // day of starting (see enqueueReminders in lib/db/notifications.ts).
    // Cleared when it's moved further out, so they're reminded again.
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    // set on each date of a repeating event
    seriesId: text("series_id").references(() => eventSeries.id),
  },
  (t) => [
    index("events_series_id_idx").on(t.seriesId),
    // the notification poller's checks look at today's and tomorrow's events
    // every 15 seconds (enqueueReminders, checkUnfilledSlots)
    index("events_date_idx").on(t.date),
    // an event with no host circle is hosted by its organizer and is live
    // from the start; only a circle-hosted one can be awaiting approval
    // only a meeting or a circle-hosted event waits on its circle's consent;
    // one a person hosts is live from the start
    check("events_live_or_proposed", sql`${t.hostCircleId} is not null or ${t.kind} = 'meeting' or ${t.approvedAt} is not null`),
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
    channel: text("channel").$type<NotificationChannel>().notNull().default("email"),
    // delivered as a line in the member's daily digest rather than an email of
    // its own — for circles too big to email about each event one at a time
    digest: boolean("digest").notNull().default(false),
    // an "updated" row's when-and-where from before the change (null on every
    // other kind)
    change: jsonb("change").$type<EventChange>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.memberId, t.kind, t.channel] }),
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

// a meeting's agenda, one row per item in order. Only ever rewritten as a
// whole with the meeting (see writeAgenda in lib/db/events.ts), and gone with it.
export const eventAgendaItems = pgTable(
  "event_agenda_items",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    category: text("category").$type<AgendaCategory>().notNull(),
    title: text("title").notNull(),
    details: text("details"),
  },
  (t) => [
    unique("event_agenda_items_event_position").on(t.eventId, t.position),
    check("event_agenda_items_category", sql`${t.category} in ('report', 'explore', 'decide')`),
  ]
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
/* An invitation for a member to join a circle, from one of its members. It
   waits until the invitee accepts (they join, and the row goes), declines,
   or a member of the circle deletes it. Seen only by the invitee and the
   circle's members (lib/db/invitations.ts). One per member per circle. */
export const circleInvitations = pgTable(
  "circle_invitations",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    // null once the member who sent it no longer exists
    invitedBy: integer("invited_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("circle_invitations_circle_member_unique").on(t.circleId, t.memberId), index("circle_invitations_member_idx").on(t.memberId)]
);

/* An application to join: how someone who isn't a member yet asks to become
   one. It starts unconfirmed until the applicant enters the code emailed to
   them (so the address is really theirs), then waits for a system admin, who
   checks the photo is a real face.
   Approving creates the member, their login and their neighborhood
   membership; either decision emails the applicant. The photo is only
   for that review: it's cleared once it's decided (an approved photo moves to
   member_photos). */
export const applicationStatus = pgEnum("application_status", ["unconfirmed", "pending", "approved", "declined"]);

export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    neighborhoodId: text("neighborhood_id").notNull().references(() => circles.id),
    photo: bytea("photo"),
    photoType: text("photo_type"),
    status: applicationStatus("status").notNull().default("unconfirmed"),
    // the emailed confirmation code, hashed, while it's unconfirmed
    confirmCodeHash: text("confirm_code_hash"),
    confirmExpiresAt: timestamp("confirm_expires_at", { withTimezone: true }),
    confirmAttempts: integer("confirm_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // the beta terms and privacy notes agreed to (BETA_AGREEMENT_VERSION), and
    // when — null only on applications from before there was an agreement
    agreementVersion: text("agreement_version"),
    agreedAt: timestamp("agreed_at", { withTimezone: true }),
    // when it was confirmed, and so reached the admins
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: integer("decided_by").references(() => members.id),
    // the reviewer's note to a declined applicant, which their email includes
    note: text("note"),
    // the member an approved application became
    memberId: integer("member_id").references(() => members.id),
  },
  (t) => [
    // one open application per address at a time
    uniqueIndex("applications_open_email_unique").on(sql`lower(${t.email})`).where(sql`${t.status} in ('unconfirmed', 'pending')`),
    index("applications_status_idx").on(t.status),
  ]
);

export const resourceIcon = pgEnum("resource_icon", ["folder", "file", "video", "announcement", "survey"]);

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
    // an announcement is a message to the circle's members, with no link;
    // every other kind (folder, file, video, survey) is a link, with a message
    // about it if its poster wrote one
    url: text("url"),
    message: text("message"),
    icon: resourceIcon("icon").notNull(),
    // display order (newest first), and the date an announcement shows
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // who posted it, which an announcement shows; null for items from before
    // it was recorded, or once that member is gone
    createdBy: integer("created_by").references(() => members.id, { onDelete: "set null" }),
  },
  (t) => [
    index("circle_resources_circle_id_idx").on(t.circleId),
    // compared as text, not the enum: a new enum value can't be used in the
    // transaction that adds it, which a fresh database's migrations share
    check(
      "circle_resources_link_or_message",
      sql`(${t.icon}::text = 'announcement' and ${t.message} is not null and ${t.url} is null) or (${t.icon}::text <> 'announcement' and ${t.url} is not null)`
    ),
  ]
);

/* An email owed to a member about an announcement just posted to their
   circle's bulletin — the same queue as event_notifications (claimed, retried,
   drained by lib/notify.ts), kept apart since it's about a bulletin item, not
   an event. Gone with the announcement, so one removed before it's sent never
   goes out. */
export const announcementNotifications = pgTable(
  "announcement_notifications",
  {
    resourceId: text("resource_id").notNull().references(() => circleResources.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    channel: text("channel").$type<NotificationChannel>().notNull().default("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [
    primaryKey({ columns: [t.resourceId, t.memberId, t.channel] }),
    index("announcement_notifications_pending_idx").on(t.createdAt).where(sql`${t.sentAt} is null`),
  ]
);

/* A circle's tasks (lib/db/tasks.ts): its members' shared backlog, seen and
   changed by any of them, by no one else. The assignee, if any, is one of its
   members; one who leaves it is unassigned (leaveCircle). */
export const circleTasks = pgTable(
  "circle_tasks",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    priority: text("priority").$type<TaskPriority>().notNull().default("none"),
    dueDate: date("due_date"),
    assigneeId: integer("assignee_id").references(() => members.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // when it was marked done, for the Done list's order
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("circle_tasks_circle_idx").on(t.circleId), index("circle_tasks_assignee_idx").on(t.assigneeId)]
);

/* A post to a neighborhood's bulletin by a Circle inside it (see
   lib/db/neighborhood-posts.ts): unpublished (published_at null) while its
   circle decides it by consent, then seen by the neighborhood's residents
   and told to them in their daily digest. An objection or a withdrawal
   deletes it; its proposal keeps what it said. */
export const neighborhoodPosts = pgTable(
  "neighborhood_posts",
  {
    id: text("id").primaryKey(),
    neighborhoodId: text("neighborhood_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    circleId: text("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    message: text("message"),
    icon: resourceIcon("icon").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: integer("created_by").references(() => members.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("neighborhood_posts_neighborhood_idx").on(t.neighborhoodId),
    check(
      "neighborhood_posts_link_or_message",
      sql`(${t.icon}::text = 'announcement' and ${t.message} is not null and ${t.url} is null) or (${t.icon}::text <> 'announcement' and ${t.url} is not null)`
    ),
  ]
);

/* A change to a circle that needs its members' consent (lib/db/proposals.ts):
   its name, tagline, type, parent or roles. Open until `closes_at`, when it
   passes if no one has objected; one objection closes it as objected, and it
   passes early once every member has consented. Only one open at a time per
   circle, so two can't change the same thing at once. */
export const circleProposals = pgTable(
  "circle_proposals",
  {
    id: text("id").primaryKey(),
    // what it's for (ProposalKind)
    kind: text("kind").$type<ProposalKind>().notNull().default("change"),
    // whose members decide it: see CircleProposal in lib/types.ts
    circleId: text("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    // a change a neighborhood (circle_id) decides about a circle inside it
    subjectCircleId: text("subject_circle_id").references((): AnyPgColumn => circles.id, { onDelete: "cascade" }),
    // a post to the neighborhood's bulletin, kept null once it's gone
    postId: text("post_id").references((): AnyPgColumn => neighborhoodPosts.id, { onDelete: "set null" }),
    proposerId: integer("proposer_id").notNull().references(() => members.id),
    // set for a proposal to hold an event the circle hosts (a group's: see
    // lib/db/proposals.ts), rather than to change the circle. Kept when the
    // event goes (an objection or a withdrawal deletes it), so the record stays.
    eventId: text("event_id").references((): AnyPgColumn => events.id, { onDelete: "set null" }),
    // what it would change (ProposalChanges), and how that read when proposed
    changes: jsonb("changes").$type<ProposalChanges>().notNull(),
    lines: jsonb("lines").$type<ProposalLine[]>().notNull(),
    status: text("status").$type<ProposalStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // a withdrawn event proposal that wasn't withdrawn by anyone: its event's
    // start came before the circle had decided (withdrawLapsedEventProposals)
    lapsed: boolean("lapsed").notNull().default(false),
  },
  (t) => [
    index("circle_proposals_circle_idx").on(t.circleId),
    // one open change to a circle at a time, whoever decides it; any number of
    // events, posts and new circles can be open
    uniqueIndex("circle_proposals_one_open").on(sql`coalesce(${t.subjectCircleId}, ${t.circleId})`).where(sql`${t.status} = 'open' and ${t.kind} = 'change'`),
    index("circle_proposals_subject_idx").on(t.subjectCircleId),
    index("circle_proposals_open_idx").on(t.closesAt).where(sql`${t.status} = 'open'`),
  ]
);

// each member's answer to a proposal; they can change it while it's open
export const proposalResponses = pgTable(
  "proposal_responses",
  {
    proposalId: text("proposal_id").notNull().references(() => circleProposals.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    response: text("response").$type<ConsentResponse>().notNull(),
    reason: text("reason"),
    respondedAt: timestamp("responded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.memberId] })]
);

/* The queue behind telling a circle's members about a proposal: that one's
   been opened ("opened"), that someone objected ("objected"), or that it
   passed ("passed"). Leased and retried exactly as event_notifications is. */
export const proposalNotifications = pgTable(
  "proposal_notifications",
  {
    proposalId: text("proposal_id").notNull().references(() => circleProposals.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ProposalNoticeKind>().notNull(),
    channel: text("channel").$type<NotificationChannel>().notNull().default("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [
    primaryKey({ columns: [t.proposalId, t.memberId, t.kind, t.channel] }),
    index("proposal_notifications_pending_idx").on(t.createdAt).where(sql`${t.sentAt} is null`),
  ]
);

/* The queue behind a neighborhood's news in its residents' daily digest: a
   post published to its bulletin, or a proposal it's been asked to decide (a
   new Circle in it, say). Email only, drained with the event digest rows
   (lib/notify.ts's deliverDigests), leased and retried as they are. */
export const neighborhoodNotifications = pgTable(
  "neighborhood_notifications",
  {
    // exactly one of the two
    postId: text("post_id").references(() => neighborhoodPosts.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id").references(() => circleProposals.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [
    uniqueIndex("neighborhood_notifications_post").on(t.postId, t.memberId),
    uniqueIndex("neighborhood_notifications_proposal").on(t.proposalId, t.memberId),
    index("neighborhood_notifications_pending_idx").on(t.createdAt).where(sql`${t.sentAt} is null`),
    check("neighborhood_notifications_one_item", sql`(${t.postId} is null) <> (${t.proposalId} is null)`),
  ]
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
