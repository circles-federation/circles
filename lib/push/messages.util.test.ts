import { describe, expect, it } from "vitest";
import { announcementPush, chatPush, circleMessagePush, digestPush, eventNotificationPush, invitationPush, photoDecisionPush, proposalPush, taskAssignedPush, type EventPushData } from "./messages.util";

const event = (over: Partial<EventPushData> = {}): EventPushData => ({
  eventId: "e1",
  notice: "new",
  title: "Seed swap",
  kind: "ordinary",
  date: "2026-11-14",
  start: "10:00",
  end: "12:00",
  location: "The garden",
  description: "",
  circleName: "Garden",
  circleType: "circle",
  proposed: false,
  votesNeeded: 0,
  organizerName: "Mira",
  ...over,
});

// a lock screen cuts these off, so none may run longer
const fits = (m: { title: string; body: string }) => {
  expect(m.title.length).toBeLessThanOrEqual(80);
  expect(m.body.length).toBeLessThanOrEqual(180);
};

describe("event pushes", () => {
  it("open the event and are tagged by it, so a newer one replaces an older", () => {
    for (const notice of ["new", "approved", "updated", "reminder", "reminder_2h", "reminder_1h", "short", "cancelled"] as const) {
      const m = eventNotificationPush(event({ notice, change: { was: { date: "2026-11-13", start: "10:00", end: "12:00", location: "Elsewhere" } }, openSlots: [{ label: "Lead", min: 1, filled: 0 }] }));
      expect(m.url).toBe("/events/e1");
      expect(m.tag).toBe("event-e1");
      fits(m);
    }
  });

  it("says a cancelled event was called off, by whom, or that a required role went unfilled", () => {
    expect(eventNotificationPush(event({ notice: "cancelled" })).body).toContain("Mira called it off");
    const auto = eventNotificationPush(event({ notice: "cancelled", cancelledAutomatically: true, openSlots: [{ label: "Librarian", min: 1, filled: 0 }] }));
    expect(auto.body).toContain("Librarian");
    expect(auto.title).toBe("Cancelled: Seed swap");
  });

  it("names a changed place", () => {
    const m = eventNotificationPush(event({ notice: "updated", location: "The hall", change: { was: { date: "2026-11-14", start: "10:00", end: "12:00", location: "The garden" } } }));
    expect(m.title).toBe("Changed: Seed swap");
    expect(m.body).toBe("Now at The hall.");
  });

  it("names a moved date and time, and says when it applies to the dates after it", () => {
    const m = eventNotificationPush(event({ notice: "updated", repeat: { frequency: "weekly", startsOn: "2026-11-07" }, change: { andLater: true, was: { date: "2026-11-13", start: "10:00", end: "12:00", location: "The garden" } } }));
    expect(m.body).toBe("Now Sat, Nov 14 · 10am–12pm. From this date on.");
  });

  it("cuts a very long title and a very long description short", () => {
    fits(eventNotificationPush(event({ title: "x".repeat(300), location: "y".repeat(300) })));
  });
});

describe("other pushes", () => {
  it("shows an announcement as its title and as much message as fits, whitespace tidied", () => {
    const m = announcementPush({ resourceId: "r1", circleId: "garden", circleName: "Garden", title: "Hall closed", message: "Closed\n\n  all   week " + "z".repeat(400), posterName: "Mira" });
    expect(m.body.startsWith("Mira: Closed all week")).toBe(true);
    expect(m.url).toBe("/circles/garden");
    expect(m.tag).toBe("announcement-r1");
    fits(m);
  });

  it("opens a proposal, tells of an objection with the reason, and of a pass", () => {
    const base = { proposalId: "p1", kind: "change" as const, circleName: "Garden", changes: {}, lines: [], closesAt: new Date(2026, 10, 14, 15), proposerName: "Mira" };
    const opened = proposalPush({ ...base, notice: "opened" });
    expect(opened.body).toContain("from Mira");
    expect(opened.url).toBe("/proposals/p1");
    expect(proposalPush({ ...base, notice: "objected", objectorName: "Tomas", reason: "Too costly" }).body).toBe("Tomas: Too costly");
    expect(proposalPush({ ...base, notice: "passed" }).title).toMatch(/^Passed: /);
    for (const notice of ["opened", "objected", "passed"] as const) fits(proposalPush({ ...base, notice, reason: "r".repeat(500) }));
  });

  it("says who invited you, falling back to a member, and opens the invitation", () => {
    expect(invitationPush({ invitationId: "i1", inviterName: "Mira", circleName: "Garden", tagline: "Grow" })).toMatchObject({ title: "Mira invited you to Garden", body: "Grow", url: "/invitations/i1" });
    expect(invitationPush({ invitationId: "i1", circleName: "Garden", tagline: "" })).toMatchObject({ title: "A member invited you to Garden", body: "Open it to accept or decline." });
  });

  it("tells of a photo decision, with the reviewer's note when it's declined", () => {
    expect(photoDecisionPush({ memberId: 5, approved: true }).url).toBe("/profile/5");
    const declined = photoDecisionPush({ memberId: 5, approved: false, note: "Show your face" });
    expect([declined.body, declined.url]).toEqual(["Show your face", "/profile/edit"]);
    expect(photoDecisionPush({ memberId: 5, approved: false }).body).toContain("keeps the photo it had");
  });

  it("opens an assigned task with its circle and due date", () => {
    const m = taskAssignedPush({ taskId: "t1", circleId: "garden", circleName: "Garden", title: "Order soil", assignerName: "Mira", due: "Fri, Nov 14" });
    expect(m).toMatchObject({ title: "Mira gave you a task", body: "Order soil · Garden · Fri, Nov 14", url: "/circles/garden/tasks/t1" });
  });

  it("nudges toward the email with none of the digest's detail", () => {
    const m = digestPush();
    expect(m.tag).toBe("digest");
    expect(m.body).not.toMatch(/\d/);
  });

  it("opens a circle's message from its sender", () => {
    expect(circleMessagePush({ messageId: "m1", circleId: "garden", circleName: "Garden", senderName: "Ona", subject: "Hall?" })).toMatchObject({ title: "Ona wrote to Garden", body: "Hall?", url: "/circles/garden/inbox/m1" });
  });
});

describe("chat pushes", () => {
  const base = { circleId: "garden", circleName: "Garden", authorName: "Mira", scheme: 0, tagged: false };

  it("show the text with its Markdown taken out, tagged by circle so a burst is one notification", () => {
    const m = chatPush({ ...base, body: "**Bring** a [rake](https://x.org)" });
    expect(m).toMatchObject({ title: "Mira in Garden", body: "Bring a rake (https://x.org)", url: "/circles/garden/chat", tag: "chat-garden" });
  });

  it("say when you were tagged", () => {
    expect(chatPush({ ...base, tagged: true, body: "hi" }).title).toBe("Mira tagged you in Garden");
  });

  it("never carry the text of a message that isn't plain", () => {
    const m = chatPush({ ...base, scheme: 1, body: "ciphertext-or-secret" });
    expect(m.body).toBe("Open Circles to read it.");
  });
});
