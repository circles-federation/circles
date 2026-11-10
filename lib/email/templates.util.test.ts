import { describe, expect, it } from "vitest";
import {
  LOGIN_CODE_MINUTES,
  announcementEmail,
  applicationApprovedEmail,
  applicationCodeEmail,
  applicationDeclinedEmail,
  circleMessageEmail,
  digestEmail,
  eventNotificationEmail,
  guestEmail,
  guestMessageCodeEmail,
  guestRsvpCodeEmail,
  invitationEmail,
  loginCodeEmail,
  photoDecisionEmail,
  proposalEmail,
  proposalWords,
  taskAssignedEmail,
  type DigestEventData,
  type EventNotificationData,
  type ProposalEmailData,
} from "./templates.util";

// what a member could type into any field an email repeats
const EVIL = '<script>alert(1)</script><img src=x onerror=alert(1)>"\'&';
const raw = /<(script|img)\b/i;

describe("loginCodeEmail", () => {
  const mail = loginCodeEmail("123456");
  it("carries the code and how long it lasts, in both parts", () => {
    expect(mail.text).toContain("123456");
    expect(mail.text).toContain(String(LOGIN_CODE_MINUTES));
    expect(mail.html).toContain("123456");
    expect(mail.subject).toBeTruthy();
  });
});

describe("escaping member-typed text in HTML", () => {
  it("announcementEmail", () => {
    const mail = announcementEmail({ circleName: EVIL, title: EVIL, message: `${EVIL}\nsecond line`, posterName: EVIL, createdAt: new Date(2026, 10, 10), url: `https://x.org/?a=${EVIL}` });
    expect(mail.html).not.toMatch(raw);
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("<br>");
    // plain text is plain text: nothing to escape there, and nothing lost
    expect(mail.text).toContain(EVIL);
  });
  it("announcementEmail signs with the date alone when the poster is unknown", () => {
    const mail = announcementEmail({ circleName: "C", title: "T", message: "M", createdAt: new Date(2026, 10, 10, 12), url: "https://x.org" });
    expect(mail.text).toContain("— 11/10/2026");
  });
  it("invitationEmail", () => {
    const mail = invitationEmail({ name: EVIL, inviterName: EVIL, circleName: EVIL, tagline: EVIL, url: `https://x.org/"onclick="x` });
    expect(mail.html).not.toMatch(raw);
    expect(mail.html).not.toContain('"onclick="x');
  });
  it("invitationEmail without an inviter or tagline", () => {
    const mail = invitationEmail({ name: "Ada", circleName: "Garden", tagline: "", url: "https://x.org" });
    expect(mail.subject).toBe("A member invited you to join Garden");
    expect(mail.text).not.toContain("Garden: ");
  });
  it("taskAssignedEmail", () => {
    const mail = taskAssignedEmail({ name: EVIL, assignerName: EVIL, circleName: EVIL, title: EVIL, due: "Due today", url: "https://x.org" });
    expect(mail.html).not.toMatch(raw);
    expect(mail.text).toContain("Due today".toLowerCase());
  });
  it("circleMessageEmail renders the body through messageHtml, which is safe", () => {
    const mail = circleMessageEmail({ name: "Ada", circleName: EVIL, senderName: EVIL, subject: EVIL, body: `${EVIL}\n\n[click](javascript:alert(1)) [ok](https://example.org)`, url: "https://x.org" });
    expect(mail.html).not.toMatch(raw);
    expect(mail.html).not.toMatch(/href="javascript:/i);
    expect(mail.html).toContain('href="https://example.org"');
    // the plain part has the Markdown taken out
    expect(mail.text).toContain("ok (https://example.org)");
  });
});

const baseEvent: EventNotificationData = {
  notice: "new",
  title: "Seed swap",
  kind: "ordinary",
  date: "2026-11-14",
  start: "10:00",
  end: "12:00",
  location: "The garden",
  description: "Bring seeds.",
  circleName: "Garden",
  circleType: "circle",
  proposed: false,
  votesNeeded: 0,
  organizerName: "Mira",
  url: "https://circles.test/events/e1",
};

describe("eventNotificationEmail", () => {
  it("says what's happening, when and where, and links to it, in both parts", () => {
    const mail = eventNotificationEmail(baseEvent);
    for (const part of [mail.text, mail.html ?? ""]) {
      expect(part).toContain("Seed swap");
      expect(part).toContain("The garden");
      expect(part).toContain("https://circles.test/events/e1");
    }
    expect(mail.text).toContain("10am–12pm");
  });

  it("escapes whatever a member typed into an event", () => {
    const mail = eventNotificationEmail({ ...baseEvent, title: EVIL, location: EVIL, description: EVIL, organizerName: EVIL, circleName: EVIL, hostCircleName: EVIL });
    expect(mail.html).not.toMatch(raw);
  });

  it("is a different email for each thing that can happen", () => {
    const subjects = (["new", "approved", "updated", "reminder", "reminder_2h", "reminder_1h", "short", "cancelled"] as const).map((notice) =>
      eventNotificationEmail({ ...baseEvent, notice, change: { was: { date: "2026-11-13", start: "10:00", end: "12:00", location: "Elsewhere" } }, openSlots: [{ label: "Lead", min: 1, filled: 0 }], today: "2026-11-13", autoCancel: true }).subject
    );
    expect(new Set(subjects).size).toBeGreaterThanOrEqual(5);
    for (const s of subjects) expect(s).toContain("Seed swap");
  });

  it("shows what an update moved, with the old value", () => {
    const mail = eventNotificationEmail({ ...baseEvent, notice: "updated", location: "The hall", change: { was: { date: "2026-11-14", start: "10:00", end: "12:00", location: "The garden" } } });
    expect(mail.text).toContain("The hall");
    expect(mail.text).toContain("The garden");
    expect(mail.html).toContain("line-through");
  });

  it("says a cancelled event was called off automatically, and which role was short", () => {
    const mail = eventNotificationEmail({ ...baseEvent, notice: "cancelled", cancelledAutomatically: true, openSlots: [{ label: "Librarian", min: 1, filled: 0 }] });
    expect(mail.text).toMatch(/automatic/i);
    expect(mail.text).toContain("Librarian");
  });

  it("gives a guest's emails the way to stop them", () => {
    const mail = guestEmail({ ...baseEvent, notice: "cancelled", guestName: "Pat", unsubscribeUrl: "https://circles.test/e/stop/g1" });
    expect(mail.text).toContain("https://circles.test/e/stop/g1");
    expect(mail.html).toContain("https://circles.test/e/stop/g1");
  });
});

describe("digestEmail", () => {
  const e = (over: Partial<DigestEventData> = {}): DigestEventData => ({ notice: "new", title: "Seed swap", kind: "ordinary", date: "2026-11-14", start: "10:00", end: "12:00", location: "The garden", circleName: "Garden", organizerName: "Mira", url: "https://circles.test/events/e1", ...over });

  it("counts new events, and says updates once it holds more than events", () => {
    expect(digestEmail({ events: [e(), e({ title: "Bike repair", url: "https://circles.test/events/e2" })] }).subject).toContain("2 new events");
    const mixed = digestEmail({ events: [e()], proposals: [{ title: "A new Circle", neighborhoodName: "The 903", proposerName: "Mira", closesAt: new Date(2026, 10, 17), url: "https://circles.test/proposals/p1" }] });
    expect(mixed.subject).toContain("2 updates");
  });

  it("lists events soonest first, grouped by circle", () => {
    const text = digestEmail({ events: [e({ title: "Later", date: "2026-11-20" }), e({ title: "Sooner", date: "2026-11-15" }), e({ title: "Elsewhere", circleName: "Co-op", date: "2026-11-01" })] }).text;
    expect(text.indexOf("Sooner")).toBeLessThan(text.indexOf("Later"));
    expect(text).toContain("Garden");
    expect(text).toContain("Co-op");
  });

  it("puts a neighborhood's bulletin and what it's asked to decide above the events, escaped", () => {
    const mail = digestEmail({
      events: [e()],
      posts: [{ title: EVIL, kindLabel: "Announcement", message: EVIL, circleName: EVIL, neighborhoodName: "The 903", posterName: EVIL, pageUrl: "https://circles.test/circles/the903" }],
      proposals: [{ title: EVIL, neighborhoodName: "The 903", proposerName: EVIL, closesAt: new Date(2026, 10, 17), url: "https://circles.test/proposals/p1" }],
    });
    expect(mail.html).not.toMatch(raw);
    expect(mail.text.indexOf("Announcement")).toBeLessThan(mail.text.indexOf("Seed swap"));
  });
});

describe("proposalEmail", () => {
  const base: ProposalEmailData = {
    notice: "opened",
    proposalId: "p1",
    kind: "change",
    circleName: "Garden",
    changes: { name: "Gardeners" },
    lines: [{ label: "Name", before: "Garden", after: "Gardeners" }],
    closesAt: new Date(2026, 10, 17, 9),
    proposerName: "Mira",
    url: "https://circles.test/proposals/p1",
  };

  it("asks for an answer by the deadline, listing what changes", () => {
    const mail = proposalEmail(base);
    expect(mail.text).toContain("Garden → Gardeners");
    expect(mail.text).toContain("https://circles.test/proposals/p1");
    expect(mail.text).toContain("Mira");
  });

  it("carries the objector's reason, and says when it passed", () => {
    expect(proposalEmail({ ...base, notice: "objected", objectorName: "Tomas", reason: "Too costly" }).text).toContain("Too costly");
    expect(proposalEmail({ ...base, notice: "passed" }).subject).toMatch(/passed/i);
  });

  it("escapes what members typed", () => {
    const mail = proposalEmail({ ...base, notice: "objected", circleName: EVIL, proposerName: EVIL, objectorName: EVIL, reason: EVIL, lines: [{ label: EVIL, before: EVIL, after: EVIL }] });
    expect(mail.html).not.toMatch(raw);
  });

  it("has words for each kind of proposal", () => {
    for (const kind of ["change", "event", "post", "new_circle", "remove_message"] as const) {
      const w = proposalWords({ kind, circleName: "Garden", changes: {} });
      expect(w.made && w.ask && w.passed).toBeTruthy();
    }
  });
});

describe("one-time codes and decisions", () => {
  it("each carry their code and how long it lasts", () => {
    for (const mail of [applicationCodeEmail("654321", 30), guestRsvpCodeEmail("654321", 30, "Seed swap"), guestMessageCodeEmail("654321", 30, "Garden")]) {
      expect(mail.text).toContain("654321");
      expect(mail.text).toContain("30");
      expect(mail.html).toContain("654321");
    }
  });

  it("names what a guest is confirming, escaped", () => {
    expect(guestRsvpCodeEmail("123456", 30, EVIL).html).not.toMatch(raw);
    expect(guestMessageCodeEmail("123456", 30, EVIL).html).not.toMatch(raw);
  });

  it("welcomes an approved applicant with the way in, and gives a decline's note", () => {
    const approved = applicationApprovedEmail({ firstName: "Ona", neighborhoodName: "The 903", url: "https://circles.test" });
    expect(approved.text).toContain("Ona");
    expect(approved.text).toContain("https://circles.test");
    const declined = applicationDeclinedEmail({ firstName: "Ona", neighborhoodName: "The 903", note: "Not in the neighborhood" });
    expect(declined.text).toContain("Not in the neighborhood");
    expect(applicationDeclinedEmail({ firstName: EVIL, neighborhoodName: EVIL, note: EVIL }).html).not.toMatch(raw);
  });

  it("tells of a photo decision, with the note only on a decline", () => {
    expect(photoDecisionEmail({ name: "Ona", approved: true, url: "https://circles.test/profile/1" }).text).toContain("https://circles.test/profile/1");
    expect(photoDecisionEmail({ name: "Ona", approved: false, note: "Show your face", url: "https://circles.test/profile/edit" }).text).toContain("Show your face");
    expect(photoDecisionEmail({ name: EVIL, approved: false, note: EVIL, url: "https://circles.test" }).html).not.toMatch(raw);
  });
});
