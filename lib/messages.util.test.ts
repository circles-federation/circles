import { describe, expect, it } from "vitest";
import { MESSAGE_BODY_MAX, MESSAGE_SUBJECT_MAX, messageHtml, messageText, messageWhen, validateMessage } from "./messages.util";

describe("validateMessage", () => {
  const ok = { subject: "Hello", body: "Hi there", consent: true };
  it("accepts a good message", () => expect(validateMessage(ok)).toBeNull());
  it("needs a subject", () => expect(validateMessage({ ...ok, subject: "  " })).toMatch(/subject/));
  it("limits the subject", () => {
    expect(validateMessage({ ...ok, subject: "x".repeat(MESSAGE_SUBJECT_MAX + 1) })).toMatch(/subject/);
    expect(validateMessage({ ...ok, subject: "x".repeat(MESSAGE_SUBJECT_MAX) })).toBeNull();
  });
  it("needs a body with words in it, not only Markdown symbols", () => {
    expect(validateMessage({ ...ok, body: "" })).toMatch(/Write a message/);
    expect(validateMessage({ ...ok, body: "  ** ** \n\n- " })).toMatch(/Write a message/);
  });
  it("limits the body", () => {
    expect(validateMessage({ ...ok, body: "x".repeat(MESSAGE_BODY_MAX + 1) })).toMatch(/message/);
    expect(validateMessage({ ...ok, body: "x".repeat(MESSAGE_BODY_MAX) })).toBeNull();
  });
  it("needs consent to be replied to", () => expect(validateMessage({ ...ok, consent: false })).toMatch(/replied to/));
});

describe("messageText", () => {
  it("strips emphasis, headings, quotes and list markers", () => {
    expect(messageText("# Title\n\n**bold** and _it_ and ~~gone~~ and `code`")).toBe("Title\n\nbold and it and gone and code");
    expect(messageText("> quoted\n- one\n* two\n1. three")).toBe("quoted\none\ntwo\nthree");
  });
  it("keeps a link's address after its words", () => {
    expect(messageText("see [the site](https://example.org)")).toBe("see the site (https://example.org)");
  });
  it("keeps only an image's alt text", () => {
    expect(messageText("![a cat](https://example.org/cat.png)")).toBe("a cat");
  });
  it("unescapes backslashes and collapses blank lines", () => {
    expect(messageText("1\\. not a list\n\n\n\nnext")).toBe("1. not a list\n\nnext");
  });
});

describe("messageHtml", () => {
  it("renders what the editor writes", () => {
    const html = messageHtml("**bold** and *italic*\n\n- one\n- two\n\n1. a\n2. b");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
  });
  it("turns a line break into <br>", () => {
    expect(messageHtml("one\ntwo")).toContain("<br");
  });
  it("shows typed HTML as text, never as markup", () => {
    const html = messageHtml('<script>alert(1)</script> <img src=x onerror=alert(1)> <b>hi</b>');
    expect(html).not.toMatch(/<script|<img|<b>/i);
    expect(html).toContain("&lt;script&gt;");
  });
  it("shows a block of HTML as text too", () => {
    const html = messageHtml('<div onclick="x()">\nhello\n</div>');
    expect(html).not.toMatch(/<div/i);
  });
  it("links web and mail addresses, opening safely in a new tab", () => {
    const html = messageHtml("[site](https://example.org) [mail](mailto:a@b.org) [plain](http://example.org)");
    expect(html).toContain('<a href="https://example.org" target="_blank" rel="noopener noreferrer nofollow">site</a>');
    expect(html).toContain('href="mailto:a@b.org"');
    expect(html).toContain('href="http://example.org"');
  });
  it("shows any other link as its words alone", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", " javascript:alert(1)", "ftp://x.org"]) {
      const html = messageHtml(`[click](${href})`);
      expect(html, href).not.toMatch(/<a\b/i);
      expect(html).toContain("click");
    }
  });
  it("can't break out of the href attribute", () => {
    const html = messageHtml('[x](https://example.org/"onmouseover="alert(1))');
    expect(html).not.toMatch(/onmouseover="alert/);
  });
  it("an autolinked bare address is still just a safe link", () => {
    const html = messageHtml("https://example.org/a");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
  it("images become their alt text, escaped", () => {
    const html = messageHtml('![<b>x</b>](https://example.org/a.png)');
    expect(html).not.toMatch(/<img|<b>/);
  });
});

describe("messageWhen", () => {
  const now = new Date(2026, 10, 10, 15, 0);
  it("the time today", () => expect(messageWhen(new Date(2026, 10, 10, 9, 5).toISOString(), now)).toBe("9:05am"));
  it("Yesterday", () => expect(messageWhen(new Date(2026, 10, 9, 23, 59).toISOString(), now)).toBe("Yesterday"));
  it("the day, without the year this year", () => expect(messageWhen(new Date(2026, 9, 20).toISOString(), now)).toBe("Oct 20"));
  it("with the year in another", () => expect(messageWhen(new Date(2025, 9, 20).toISOString(), now)).toBe("Oct 20, 2025"));
  it("counts days by calendar, not 24-hour spans", () => {
    expect(messageWhen(new Date(2026, 10, 9, 0, 1).toISOString(), new Date(2026, 10, 10, 23, 59))).toBe("Yesterday");
  });
});
