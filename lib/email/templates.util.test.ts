import { describe, expect, it } from "vitest";
import { LOGIN_CODE_MINUTES, announcementEmail, circleMessageEmail, invitationEmail, loginCodeEmail, taskAssignedEmail } from "./templates.util";

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
