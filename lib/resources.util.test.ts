import { describe, expect, it } from "vitest";
import { parseResourceUrl, resourceHost, validateResourceInput, type ResourceInput } from "./resources.util";

const link = (over: Partial<ResourceInput> = {}): ResourceInput => ({ title: "Drive", icon: "folder", url: "https://drive.example.org/x", message: "", ...over });
const note = (over: Partial<ResourceInput> = {}): ResourceInput => ({ title: "News", icon: "announcement", url: "", message: "Hello all", ...over });

describe("parseResourceUrl", () => {
  it("accepts http and https", () => {
    expect(parseResourceUrl("https://example.org/a")?.hostname).toBe("example.org");
    expect(parseResourceUrl("  http://example.org ")?.protocol).toBe("http:");
  });
  it("refuses everything else", () => {
    for (const raw of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://x.org", "example.org", "", "//example.org"]) expect(parseResourceUrl(raw), raw).toBeNull();
  });
});

describe("validateResourceInput", () => {
  it("accepts a link and an announcement", () => {
    expect(validateResourceInput(link())).toEqual({});
    expect(validateResourceInput(note())).toEqual({});
  });
  it("an unknown kind stops at the kind", () => {
    expect(validateResourceInput(link({ icon: "podcast" as never }))).toEqual({ icon: expect.any(String) });
  });
  it("needs a title within the limit", () => {
    expect(validateResourceInput(link({ title: " " })).title).toBeDefined();
    expect(validateResourceInput(link({ title: "x".repeat(121) })).title).toBeDefined();
    expect(validateResourceInput(note({ title: "" })).title).toMatch(/announcement/);
  });
  it("a link needs a good link", () => {
    expect(validateResourceInput(link({ url: "" })).url).toMatch(/Add a link/);
    expect(validateResourceInput(link({ url: "javascript:alert(1)" })).url).toMatch(/http/);
    expect(validateResourceInput(link({ url: "https://x.org/" + "a".repeat(2048) })).url).toMatch(/too long/);
  });
  it("a link's message is optional but limited", () => {
    expect(validateResourceInput(link({ message: "" }))).toEqual({});
    expect(validateResourceInput(link({ message: "x".repeat(2001) })).message).toBeDefined();
  });
  it("an announcement needs its message, and ignores any link", () => {
    expect(validateResourceInput(note({ message: "  " })).message).toMatch(/Write/);
    expect(validateResourceInput(note({ message: "x".repeat(2001) })).message).toBeDefined();
    expect(validateResourceInput(note({ url: "not a url" }))).toEqual({});
  });
});

describe("resourceHost", () => {
  it("drops www", () => expect(resourceHost("https://www.example.org/a")).toBe("example.org"));
  it("is empty for a bad link", () => expect(resourceHost("nope")).toBe(""));
});
