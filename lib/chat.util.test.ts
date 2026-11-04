import { describe, expect, it } from "vitest";
import { CHAT_BODY_MAX, CHAT_EDIT_WINDOW_MS, canEditChat, highlightMentions, matchMentions, mentionAt, mentionsIn, validateChatBody } from "./chat.util";

describe("validateChatBody", () => {
  it("needs words, within the limit", () => {
    expect(validateChatBody("hi")).toBeNull();
    expect(validateChatBody("  \n ")).toMatch(/Write/);
    expect(validateChatBody("x".repeat(CHAT_BODY_MAX))).toBeNull();
    expect(validateChatBody("x".repeat(CHAT_BODY_MAX + 1))).toMatch(/4000/);
  });
});

describe("canEditChat", () => {
  const created = "2026-11-10T12:00:00.000Z";
  const at = (ms: number) => new Date(created).getTime() + ms;
  it("for 15 minutes, inclusive", () => {
    expect(canEditChat(created, at(0))).toBe(true);
    expect(canEditChat(created, at(CHAT_EDIT_WINDOW_MS))).toBe(true);
    expect(canEditChat(created, at(CHAT_EDIT_WINDOW_MS + 1))).toBe(false);
  });
});

describe("mentionAt", () => {
  it("finds the @word at the caret", () => {
    expect(mentionAt("hi @ad", 6)).toEqual({ start: 3, query: "ad" });
    expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionAt("@ada", 4)).toEqual({ start: 0, query: "ada" });
  });
  it("only up to the caret", () => {
    expect(mentionAt("hi @ada lovelace", 5)).toEqual({ start: 3, query: "a" });
  });
  it("not in the middle of a word, an email, or after a space", () => {
    expect(mentionAt("me@ada", 6)).toBeNull();
    expect(mentionAt("hi @ada there", 13)).toBeNull();
    expect(mentionAt("hello", 5)).toBeNull();
  });
});

describe("matchMentions", () => {
  const people = [{ name: "Ada Lovelace" }, { name: "Bo Adams" }, { name: "Cy Young" }, { name: "Adrian Smith" }];
  it("matches a word that starts with the query", () => {
    expect(matchMentions(people, "ad").map((p) => p.name)).toEqual(["Ada Lovelace", "Adrian Smith", "Bo Adams"]);
  });
  it("names starting with it come first", () => {
    expect(matchMentions(people, "ad")[0]!.name).toMatch(/^Ad/);
  });
  it("is case-insensitive, and an empty query offers everyone", () => {
    expect(matchMentions(people, "LOVE").map((p) => p.name)).toEqual(["Ada Lovelace"]);
    expect(matchMentions(people, "")).toHaveLength(4);
  });
  it("does not match the middle of a word, and respects the limit", () => {
    expect(matchMentions(people, "dam")).toEqual([]);
    expect(matchMentions(people, "", 2)).toHaveLength(2);
  });
});

describe("mentionsIn", () => {
  const picked = [{ id: 1, name: "Ada Lovelace" }, { id: 2, name: "Bo" }, { id: 1, name: "Ada Lovelace" }];
  it("keeps those whose @name is still in the text, once each", () => {
    expect(mentionsIn("hi @Ada Lovelace and @Bo", picked)).toEqual([1, 2]);
  });
  it("deleting the name takes the mention back", () => {
    expect(mentionsIn("hi Ada Lovelace", picked)).toEqual([]);
  });
});

describe("highlightMentions", () => {
  it("wraps @names in text", () => {
    expect(highlightMentions("<p>hi @Ada</p>", ["Ada"])).toBe('<p>hi <span class="chat-mention">@Ada</span></p>');
  });
  it("prefers the longer name", () => {
    expect(highlightMentions("<p>@Ada Lovelace</p>", ["Ada", "Ada Lovelace"])).toBe('<p><span class="chat-mention">@Ada Lovelace</span></p>');
  });
  it("never touches a tag's attributes", () => {
    const html = '<a href="https://x.org/@Ada" title="@Ada">@Ada</a>';
    expect(highlightMentions(html, ["Ada"])).toBe('<a href="https://x.org/@Ada" title="@Ada"><span class="chat-mention">@Ada</span></a>');
  });
  it("doesn't match a longer word that merely starts with the name", () => {
    expect(highlightMentions("<p>@Adams</p>", ["Ada"])).toBe("<p>@Adams</p>");
  });
  it("treats regex characters in a name literally", () => {
    expect(highlightMentions("<p>@A.B and @AxB</p>", ["A.B"])).toBe('<p><span class="chat-mention">@A.B</span> and @AxB</p>');
    expect(highlightMentions("<p>@(x)</p>", ["(x)"])).toContain("chat-mention");
  });
  it("matches names as the HTML escapes them", () => {
    expect(highlightMentions("<p>@Tom &amp; Jerry</p>", ["Tom & Jerry"])).toContain('<span class="chat-mention">@Tom &amp; Jerry</span>');
    expect(highlightMentions("<p>@O&#39;Brien</p>", ["O'Brien"])).toContain("chat-mention");
  });
  it("does nothing without names", () => {
    expect(highlightMentions("<p>@Ada</p>", [])).toBe("<p>@Ada</p>");
  });
});
