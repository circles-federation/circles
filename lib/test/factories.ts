import type { Circle, CircleProposal, Event } from "../types";

export const circle = (over: Partial<Circle> & Pick<Circle, "id">): Circle => ({
  type: "circle",
  name: over.id,
  parentId: "city",
  tagline: "",
  about: "",
  offers: [],
  needs: [],
  members: [],
  facts: [],
  ...over,
});

export const event = (over: Partial<Event> = {}): Event => ({
  id: "e1",
  title: "Coffee",
  circleId: "city",
  organizerId: 1,
  date: "2026-11-10",
  start: "10:00",
  end: "12:00",
  location: "The park",
  description: "",
  rsvps: [],
  ...over,
});

export const proposal = (over: Partial<CircleProposal> = {}): CircleProposal => ({
  id: "p1",
  kind: "change",
  circleId: "c",
  proposerId: 1,
  changes: {},
  lines: [],
  status: "open",
  createdAt: "2026-11-01T12:00:00.000Z",
  closesAt: "2026-11-04T12:00:00.000Z",
  responses: [],
  ...over,
});

/* city > the903 (neighborhood) > council (circle), plus a citywide collective
   and a group; members are plain ids */
export const tree = () => ({
  city: circle({ id: "city", type: "other", parentId: null, name: "Providence", members: [1, 2, 3, 4] }),
  the903: circle({ id: "the903", type: "neighborhood", parentId: "city", name: "The 903", members: [1, 2, 3] }),
  council: circle({ id: "council", type: "circle", parentId: "the903", name: "Council", members: [1, 2] }),
  coop: circle({ id: "coop", type: "cooperative", parentId: "city", name: "Co-op", members: [2, 3] }),
  club: circle({ id: "club", type: "group", parentId: "city", name: "Club", members: [3] }),
});
