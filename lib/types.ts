/* Central domain-model types — the seam every other module (lib/, components/,
   app/) imports its shapes from, instead of each inferring its own structural
   type wherever a Member/Org/Event first gets constructed. */

export interface Member {
  id: number;
  name: string;
  lastName?: string;
  pronouns: string;
  role: string;
  neighborhood: string;
  skills: string[];
  interests: string[];
  bio: string;
  email?: string;
}

// the current user's own editable profile — a Member plus whether their
// email is shared publicly (see AppStateProvider, which seeds this from the
// signed-in member's own record)
export type Profile = Member & { emailPublic: boolean };

export interface Org {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  // set only on a Neighborhood Council — marks it as the org every resident
  // of that neighborhood is automatically a member of (see orgMembers() in
  // lib/orgs.util.ts, which derives the roster instead of reading `members`
  // for these orgs)
  neighborhood?: string;
  tagline: string;
  about: string;
  offers: string[];
  // member ids; unused/empty for a Neighborhood Council (roster is derived)
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

export type Host = { type: "member"; id: number } | { type: "org"; id: string };

export type EventKindKey = "ordinary" | "meeting" | "council";

export interface EventKindMeta {
  governance: boolean;
  label: string;
  threshold?: number;
}

// council-proposal sponsor summary, embedded on a confirmed federation
// council event (kind: "council") — not a full Org/Event reference
export interface EventSponsor {
  id: string;
  name: string;
  neighborhood: string;
}

// one flat interface with every governance-only field optional, rather than
// a discriminated union on `kind` — every real call site already guards
// these defensively (`e.votes || []`, `e.sponsor && ...`), and `roles`/
// `membersOnly` are cross-cutting (ordinary events use them too), so a true
// union would need a shared base + variants anyway for no real safety gain
// over guarding. Where governance logic reads several of these fields
// together and would benefit from real narrowing, use the isMeeting/
// isCouncil type guards in lib/governance.util.ts instead of widening this
// type further.
export interface Event {
  id: string;
  title: string;
  kind?: EventKindKey;
  host: Host;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  rsvps: number[];
  membersOnly?: boolean;
  roles?: Role[];
  // meeting-only: the circle (Neighborhood Council or other org) this
  // meeting is hosted by/proposed for
  orgId?: string;
  // meeting/council-only: governance votes toward quorum
  votes?: number[];
  // council-only
  scope?: "federation";
  sponsor?: EventSponsor;
  endorsements?: string[];
  // meeting-only: set when this meeting exists to endorse a pending council
  endorsesCouncilId?: string;
}

// resolved display info for an event's host — see hostInfo() in lib/data.ts
export interface HostInfo {
  label: string;
  kind: string;
  avatar: string | null;
  org: Org | null;
  member: Member | null;
}

// shared shape of the meeting-proposal details collected on both the
// new-event form (a meeting) and the governance-proposal form (a federation
// council draft, or an endorsing meeting) — see AppStateProvider's
// proposeCouncilDraft/proposeEndorsingAssembly and
// governance-proposal-form.page.tsx.
export interface ProposalDetails {
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  agenda: string;
}

// drafted on a meeting's page, awaiting that meeting's own ratification vote
// before becoming a federation-wide proposed council (see
// AppStateProvider.proposeCouncilDraft/ratifyCouncilProposal). Only exists at
// runtime — there's no seed data for it in lib/data.ts.
export interface CouncilProposal {
  id: string;
  assemblyId: string;
  sponsorHood: string;
  sponsorName: string;
  proposedBy: number;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  agenda: string;
  ratifyVotes: number[];
  ratified: boolean;
  councilId: string | null;
}
