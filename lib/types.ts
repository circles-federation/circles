/* Central domain-model types — the seam every other module (lib/, components/,
   app/) imports its shapes from, instead of each inferring its own structural
   type wherever a Member/Circle/Event first gets constructed. */

/* Everything that scopes something is a circle: the city is the root circle;
   neighborhoods, councils, collectives, and co-ops are circles inside it, and
   circles nest. `neighborhood` is the one type with behavior (a member's home
   circle, at most one per member); the rest are display/filter labels. */
export type CircleType = "neighborhood" | "council" | "collective" | "cooperative" | "other";

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
}

// the current user's own editable profile — a Member plus whether their
// email is shared publicly (see AppStateProvider, which seeds this from the
// signed-in member's own record)
export type Profile = Member & { emailPublic: boolean };

export interface Circle {
  id: string;
  type: CircleType;
  name: string;
  // null only for the root circle (the city)
  parentId: string | null;
  tagline: string;
  about: string;
  offers: string[];
  // member ids — explicit membership rows, for every circle type
  members: number[];
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
// `kind` is optional (ordinary by default); a meeting instead confirms at a
// majority of its own circle's members — see lib/governance.util.ts.
export interface Event {
  id: string;
  title: string;
  kind?: EventKindKey;
  circleId: string;
  hostCircleId?: string;
  // a circle-hosted event still awaiting its host circle's approval
  proposed?: boolean;
  organizerId: number;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  rsvps: number[];
  roles?: Role[];
  votes?: number[];
}

export type ResourceIcon = "folder" | "file";

// a link a circle's members keep for themselves — a folder (a collection,
// like a shared drive) or a file (a single document). Members-only: never a
// field on Circle, since the circles array is sent to every signed-in member;
// AppStateProvider's `resources` only ever holds the viewer's own circles'.
export interface CircleResource {
  id: string;
  circleId: string;
  title: string;
  url: string;
  icon: ResourceIcon;
}

// which email an event_notifications row is: the announcement of an event a
// person hosts ("new"), the request to vote on a circle-hosted proposal
// ("proposed"), or the news that a proposal was approved ("approved") — one
// member can be owed more than one of these for the same event
export type NotificationKind = "new" | "proposed" | "approved";
