/* Central domain-model types — the seam every other module (lib/, components/,
   app/) imports its shapes from, instead of each inferring its own structural
   type wherever a Member/Circle/Event first gets constructed. */

/* Everything that scopes something is a circle: the city is the root circle;
   neighborhoods, collectives, co-ops and plain circles (a council, a working
   group) are circles inside it, and circles nest. `neighborhood` is the one
   type with behavior (a member's home
   circle, at most one per member); the rest are display/filter labels. */
export type CircleType = "neighborhood" | "circle" | "collective" | "cooperative" | "other";

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
  email?: string;
  // set once they've uploaded a photo (its upload time, in ms) — part of the
  // photo's URL, so a replaced photo is never served from a stale cache
  photoVersion?: number;
}

// the current user's own editable profile — a Member plus whether their
// email is shared publicly (see AppStateProvider, which seeds this from the
// signed-in member's own record)
export type Profile = Member & { emailPublic: boolean };

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
  name: string;
  // null only for the root circle (the city)
  parentId: string | null;
  tagline: string;
  about: string;
  offers: string[];
  // what the circle is asking for — donations, hands, space — the other side of offers
  needs: string[];
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
  // a circle-hosted event still awaiting its host circle's approval
  proposed?: boolean;
  // cancelled by its organizer while others were going: still shown, labelled
  // so, but closed to RSVPs, votes, signups and edits (see cancelEvent)
  cancelled?: boolean;
  organizerId: number;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  rsvps: number[];
  roles?: Role[];
  votes?: number[];
  // a meeting's agenda, in order; a meeting has this instead of a description
  agenda?: AgendaItem[];
  // set on each date of a repeating event — every date is an event of its own,
  // with its own RSVPs, votes and slots
  repeat?: EventRepeat;
}

export type ResourceIcon = "folder" | "file" | "video" | "announcement";

// something a circle's members keep for themselves: a link — a folder (a
// collection, like a shared drive), a file (a single document) or a video —
// or an announcement, a message typed out for them. Members-only: never a
// field on Circle, since the circles array is sent to every signed-in member;
// AppStateProvider's `resources` only ever holds the viewer's own circles'.
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

// what an event_notifications row is telling a member: an event or meeting a
// person hosts ("new"), a circle-hosted proposal they're asked to vote on
// ("proposed"), that a proposal or meeting was approved ("approved" — a
// meeting when it reaches its vote threshold), or, to the people going, that
// its organizer cancelled it ("cancelled"). Separate from *how* it's delivered
// (an email of its own, or a line in the daily digest), and one member can be
// owed more than one of these for the same event.
export type NotificationKind = "new" | "proposed" | "approved" | "cancelled";
