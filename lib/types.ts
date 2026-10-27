/* Central domain-model types — the seam every other module (lib/, components/,
   app/) imports its shapes from, instead of each inferring its own structural
   type wherever a Member/Circle/Event first gets constructed. */

/* Everything that scopes something is a circle: the city is the root circle;
   neighborhoods, collectives, co-ops and plain circles (a council, a working
   group) are circles inside it, and circles nest. `neighborhood` is the one
   type with behavior (a member's home
   circle, at most one per member); the rest are display/filter labels. */
export type CircleType = "neighborhood" | "circle" | "collective" | "cooperative" | "other" | "group";

// a language a member speaks (a BCP 47 code) and how well, 1 (beginner) to 5
// (native) — see lib/languages.util.ts
export type LanguageLevel = 1 | 2 | 3 | 4 | 5;
export interface MemberLanguage {
  code: string;
  level: LanguageLevel;
}

// when a member can do meetings: on these days (0 = Sunday), from `start` to
// `end`, in minutes from midnight — see lib/availability.util.ts
export interface AvailabilityWindow {
  days: number[];
  start: number;
  end: number;
}

export interface Member {
  id: number;
  name: string;
  lastName?: string;
  pronouns: string;
  role: string;
  // the neighborhood-type circle this member belongs to, if any
  homeCircleId: string | null;
  skills: string[];
  interests: string[];
  bio: string;
  // the decade they were born in, as its first year (1990 for the '90s), if
  // they've chosen to say (see lib/members.util.ts)
  // in the order they listed them; always present from the database, absent
  // only from the seed fixtures, which start everyone with none
  languages?: MemberLanguage[];
  birthDecade?: number;
  email?: string;
  // set once they've uploaded a photo (its upload time, in ms) — part of the
  // photo's URL, so a replaced photo is never served from a stale cache
  photoVersion?: number;
}

// the current user's own editable profile — a Member plus whether their
// email is shared publicly (see AppStateProvider, which seeds this from the
// signed-in member's own record)
// how a member is told about the app's goings-on: by email, by push, both or
// neither (Settings → Notifications). Their own, so it's on Profile, not Member.
export interface NotificationSettings {
  email: boolean;
  push: boolean;
}

// null until they've set when they can do meetings (Settings → Meeting
// availability); their own, since others only learn whether they're free at
// a given time, from the meeting form
// pendingPhotoVersion: a new photo they've sent that a system admin hasn't
// decided on yet, which only they (and admins) can see
export type Profile = Member & { emailPublic: boolean; notifications: NotificationSettings; availability: AvailabilityWindow[] | null; pendingPhotoVersion?: number };

// who in a circle can make a meeting's date and time, as the meeting form
// shows it: `freeUntil` is minutes from midnight, for someone free as it begins
export interface MeetingAvailability {
  available: number[];
  unavailable: { id: number; freeUntil?: number }[];
  unknown: number[];
}

// a role a member can hold in a circle (Secretary, Leader, ...) — see
// lib/circle-roles.util.ts. `builtin` roles exist on every circle that can have
// roles and can't be removed; the others are the circle's own.
export interface CircleRole {
  label: string;
  builtin: boolean;
  memberId: number | null;
}

export interface Circle {
  id: string;
  type: CircleType;
  // its Inbox is on: anyone may write to it from its wiki, and its members
  // read what's written (decided by consent; lib/circles.util's circleHasInbox)
  inbox?: boolean;
  name: string;
  // null only for the root circle (the city)
  parentId: string | null;
  tagline: string;
  about: string;
  offers: string[];
  // what the circle is asking for — donations, hands, space — the other side of offers
  needs: string[];
  // a Circle's (type "circle") domain, the area it decides in, and its aims;
  // required of one, decided by consent, shown only on Manage circle for now
  domain?: string;
  aims?: string[];
  // member ids — explicit membership rows, for every circle type
  members: number[];
  // only on circles that can have roles (not a neighborhood or the city): every
  // built-in role, then the circle's own, each with its holder if it has one
  roles?: CircleRole[];
  lastEditedBy?: number;
  lastEditedAt?: string;
  facts: [string, string][];
  join?: string;
  contact?: string;
  website?: string;
  address?: string;
  hours?: [string, string][];
}

export interface Role {
  key: string;
  label: string;
  description?: string;
  min: number;
  max?: number;
  members: number[];
}

export type EventKindKey = "ordinary" | "meeting";

// Sociocracy's R/E/D: what a meeting is meant to do with an agenda item (see
// lib/agenda.util.ts)
export type AgendaCategory = "report" | "explore" | "decide";

export interface AgendaItem {
  category: AgendaCategory;
  title: string;
  details?: string;
}

export type RepeatFrequency = "weekly" | "monthly";

// a date of a repeating event: the series it's one of, and that series'
// pattern — read from its first date (see lib/recurrence.util.ts) — up to its
// last date, if it has one
export interface EventRepeat {
  seriesId: string;
  frequency: RepeatFrequency;
  startsOn: string;
  until?: string;
}

export interface EventKindMeta {
  governance: boolean;
  label: string;
}

// every event belongs to exactly one circle, which decides who can see it (and
// who would be notified of it), and is always organized by the member who
// created it (`organizerId`) — the only one who can edit it. It's hosted either
// by that person or, when `hostCircleId` is set, by a circle — which is not
// necessarily the circle it's shown to. A circle-hosted event starts as a
// proposal (`proposed`): only the host circle's members can see it, and it goes
// live for `circleId`'s audience once a majority of them vote to approve it.
// `kind` is optional (ordinary by default); a meeting instead is approved at a
// majority of its own circle's members — see lib/governance.util.ts.
export interface Event {
  id: string;
  title: string;
  kind?: EventKindKey;
  circleId: string;
  hostCircleId?: string;
  // a meeting or circle-hosted event still awaiting its circle's consent (see
  // lib/db/proposals.ts): in no list, only its proposal and its own page
  proposed?: boolean;
  // the role (Leader, Secretary or Facilitator) its organizer held in the circle
  // that would have voted on it — a meeting's own, or the host circle — which
  // approved it without a vote. A meeting like that is attended by RSVP.
  approvedByRole?: string;
  // cancelled by its organizer while others were going: still shown, labelled
  // so, but closed to RSVPs, votes, signups and edits (see cancelEvent)
  cancelled?: boolean;
  // cancelled by the app, not its organizer: a required slot was still short
  // 15 minutes before the start
  cancelledAutomatically?: true;
  // created or moved to start within the hour, so a short slot doesn't
  // cancel it (its host is still warned)
  noAutoCancel?: true;
  organizerId: number;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  rsvps: number[];
  // first names of guests who RSVPed from a share link (no account, so no id,
  // photo or profile); absent when there are none
  guests?: string[];
  roles?: Role[];
  votes?: number[];
  // a meeting's agenda, in order; a meeting has this instead of a description
  agenda?: AgendaItem[];
  // set on each date of a repeating event — every date is an event of its own,
  // with its own RSVPs, votes and slots
  repeat?: EventRepeat;
}

export type ResourceIcon = "folder" | "file" | "video" | "announcement" | "survey";

// something a circle's members keep for themselves: a link — a folder (a
// collection, like a shared drive), a file (a single document) or a video —
// or an announcement, a message typed out for them. Members-only: never a
// field on Circle, since the circles array is sent to every signed-in member;
// AppStateProvider's `resources` only ever holds the viewer's own circles'.
/* A change to a circle that needs its members' consent, as sociocracy decides
   things (see lib/proposals.util.ts): proposed by a member, open for a few
   days, and made only if no one objects. */
// green "like this", yellow "accept this" (both consent: they differ in
// enthusiasm, not reservations), or red, an objection
export type ConsentResponse = "like" | "accept" | "object";
// withdrawn: an event proposal whose event was cancelled before it was decided
export type ProposalStatus = "open" | "passed" | "objected" | "withdrawn";

// what a proposal would change, each only if it does: the circle's own fields,
// and its roles as a whole (each role's name and holder, in order)
export interface ProposalChanges {
  name?: string;
  tagline?: string;
  type?: CircleType;
  parentId?: string;
  domain?: string;
  aims?: string[];
  roles?: { label: string; memberId: number | null }[];
  // turning its Inbox on or off
  inbox?: boolean;
}

// one line of what it changes, as it read when proposed ("Name": "Ona
// Garden" → "Ona Community Garden"), so it reads the same however things
// are renamed later; `before` is empty for a role being added
export interface ProposalLine {
  label: string;
  before: string;
  after: string;
}

// what a member is told about a proposal: it's open for their response, or
// how it ended
export type ProposalNoticeKind = "opened" | "objected" | "passed";

// what a proposal is for: a change to a circle (its own, or, decided by its
// neighborhood, one inside it: see subjectCircleId), holding an event the
// circle hosts, posting to its neighborhood's bulletin, or starting a new
// Circle in a neighborhood
export type ProposalKind = "change" | "event" | "post" | "new_circle";

export interface ProposalResponse {
  memberId: number;
  response: ConsentResponse;
  // why they object, required with an objection
  reason?: string;
  respondedAt: string;
}

export interface CircleProposal {
  id: string;
  kind: ProposalKind;
  // the circle whose members decide it: its own, or for a post its posting
  // circle, or for a change a neighborhood must consent to, that neighborhood
  circleId: string;
  // a change decided by a neighborhood (circleId) about a circle in it, which
  // that circle's members decide too
  subjectCircleId?: string;
  // a post to the neighborhood's bulletin, while it exists
  postId?: string;
  proposerId: number;
  // set when it proposes holding an event the circle hosts, rather than
  // changing the circle (null once that event is gone)
  eventId?: string;
  changes: ProposalChanges;
  lines: ProposalLine[];
  status: ProposalStatus;
  createdAt: string;
  // when it passes, if no one has objected by then
  closesAt: string;
  decidedAt?: string;
  // withdrawn because its event began before it was decided, not by anyone
  lapsed?: boolean;
  responses: ProposalResponse[];
}

// an invitation for a member to join a circle, from one of its members; seen
// by the invitee and the circle's members
export interface CircleInvitation {
  id: string;
  circleId: string;
  // the circle's name and tagline, for someone who can't see the circle itself
  // yet (a group is visible only to its members)
  circleName: string;
  circleTagline: string;
  // who's invited
  memberId: number;
  // who invited them (unknown if they've since left the platform)
  invitedBy?: number;
  // ISO timestamp
  createdAt: string;
}

export interface CircleResource {
  id: string;
  circleId: string;
  title: string;
  icon: ResourceIcon;
  // an announcement has a message; every other kind has a link instead
  url?: string;
  message?: string;
  // ISO timestamp it was posted, and by whom (unknown for older items)
  createdAt: string;
  createdBy?: number;
}

/* A circle's task, on its members' shared backlog (lib/tasks.util.ts holds
   the rules). Back burner isn't a status: it's a to-do of priority "someday"
   (zzz). */
/* A circle's wiki as anyone may read it, signed in or not (its public page,
   /wiki/[id]; lib/db/circles.ts's getPublicWiki): what its Wiki tab shows,
   and nothing about its members, who edited it, or anything else in the
   app. Its sub-circles are those with a public wiki of their own. */
export interface PublicWiki {
  id: string;
  name: string;
  type: CircleType;
  tagline: string;
  facts: [string, string][];
  about: string;
  offers: string[];
  needs: string[];
  website?: string;
  address?: string;
  contact?: string;
  hours?: [string, string][];
  join?: string;
  // where it sits; the city's is told apart, as its chip is coloured
  parent?: { name: string; isCity: boolean };
  subCircles: { id: string; name: string; tagline: string }[];
  // its Inbox is on, so anyone may write to it from here
  inbox: boolean;
}

/* A message written to a circle from its wiki, read in its Inbox (lib/db/
   messages.ts): sent only to the circle's members. The sender agreed to be
   replied to at `replyEmail` (their address when they wrote, kept with the
   message), which is how they're answered: there's no replying in the app. */
export interface CircleMessage {
  id: string;
  circleId: string;
  // who wrote it (gone if they've since left the platform)
  senderId?: number;
  // written by someone without an account, from its public wiki
  guest?: true;
  senderName: string;
  replyEmail: string;
  subject: string;
  // Markdown, as the editor wrote it; rendered by lib/messages.util.ts
  body: string;
  createdAt: string;
  // whether the viewer has opened it
  read: boolean;
  // the member handling it, and who gave it to them
  assigneeId?: number;
  // filed away as dealt with
  doneAt?: string;
}

export type TaskStatus = "todo" | "doing" | "done";
// Critical, High, Medium, Normal and the back burner (see TASK_PRIORITIES)
export type TaskPriority = "urgent" | "high" | "normal" | "none" | "someday";
export interface CircleTask {
  id: string;
  circleId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  // YYYY-MM-DD, wall-clock like an event's date
  dueDate?: string;
  assigneeId?: number;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/* A post on a neighborhood's bulletin, by one of the Circles in it, seen only
   by its residents (and the posting circle's members): the same kinds as a
   circle's bulletin. Its circle consents to each one before it's published
   (lib/db/neighborhood-posts.ts). */
export interface NeighborhoodPost {
  id: string;
  neighborhoodId: string;
  circleId: string;
  title: string;
  icon: ResourceIcon;
  url?: string;
  message?: string;
  createdAt: string;
  createdBy?: number;
  // when its circle consented and it went up
  publishedAt: string;
}

// what an event_notifications row is telling a member: an event or meeting a
// person hosts ("new"), a circle-hosted proposal they're asked to vote on
// ("proposed"), that a proposal or meeting was approved ("approved" — a
// meeting when it reaches its vote threshold), or, to the people going, that
// its organizer moved it ("updated") or cancelled it ("cancelled"), or that
// it's coming up within a day ("reminder"), or, to its host, that a
// required slot is still short an hour before it starts ("short"). Separate from *how* it's delivered
// (an email of its own, or a line in the daily digest), and one member can be
// owed more than one of these for the same event.
// what a guest (someone who RSVPed from a share link) is emailed about
export type GuestNoticeKind = "confirmed" | "updated" | "cancelled";

export type NotificationKind = "new" | "proposed" | "approved" | "updated" | "cancelled" | "reminder" | "short";

// which way a queued notification goes out: each channel is its own queue
// row, sent and retried on its own, so a failed push never resends an email
// or the reverse
export type NotificationChannel = "email" | "push";

// what an "updated" notification remembers: when and where the event was
// before the change, so the email can say what moved. `andLater` marks an edit
// to a date of a repeating event and every date after it.
export interface EventChange {
  was: { date: string; start: string; end: string; location: string };
  andLater?: boolean;
}

/* An event as a stranger with a share link sees it (lib/db/event-shares.ts):
   first names only, and no ids that lead to a member's profile. */
export interface SharedEvent {
  eventId: string;
  token: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  cancelled: boolean;
  ended: boolean;
  hasRoles: boolean;
  circleName: string | null;
  hostCircleName: string | null;
  hostName: string;
  sharedBy: string;
  going: string[];
}
