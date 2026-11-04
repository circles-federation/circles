import { describe, expect, it } from "vitest";
import { birthDecadeLabel, canonicalTag, isBirthDecade, isProfileBlank, tagSuggestions } from "./members.util";
import { LANGUAGE_CODES, validateLanguages, languageName, languageEndonym, isLanguageLevel, MAX_LANGUAGES } from "./languages.util";
import type { Member } from "./types";

const blank = { pronouns: " ", role: "", bio: "", skills: [], interests: [], languages: undefined, birthDecade: undefined } as unknown as Member;

describe("isProfileBlank", () => {
  it("is blank until anything beyond applying is filled in", () => {
    expect(isProfileBlank(blank)).toBe(true);
    for (const patch of [{ pronouns: "they/them" }, { role: "Baker" }, { bio: "Hi" }, { skills: ["x"] }, { interests: ["y"] }, { languages: [{ code: "en", level: 5 }] }, { birthDecade: 1990 }]) {
      expect(isProfileBlank({ ...blank, ...patch } as Member), JSON.stringify(patch)).toBe(false);
    }
  });
  it("an empty language list is still blank", () => expect(isProfileBlank({ ...blank, languages: [] } as Member)).toBe(true));
});

describe("birth decades", () => {
  it("only the offered decades", () => {
    expect(isBirthDecade(1990)).toBe(true);
    expect(isBirthDecade(1995)).toBe(false);
    expect(isBirthDecade("1990")).toBe(false);
    expect(isBirthDecade(null)).toBe(false);
  });
  it("'90s, but 2000s in full", () => {
    expect(birthDecadeLabel(1930)).toBe("'30s");
    expect(birthDecadeLabel(1990)).toBe("'90s");
    expect(birthDecadeLabel(2000)).toBe("2000s");
    expect(birthDecadeLabel(2010)).toBe("2010s");
  });
});

describe("tagSuggestions", () => {
  const pool = ["Permaculture", "permaculture", "Permaculture", "Carpentry", "Cooking", "cooking", "Pottery", "Pet care"];
  it("suggests nothing for an empty query", () => {
    expect(tagSuggestions(pool, "  ", [])).toEqual([]);
  });
  it("folds case into the most common spelling", () => {
    expect(tagSuggestions(pool, "perma", [])).toEqual(["Permaculture"]);
  });
  it("matches anywhere, starting-with first, then most used, then A–Z", () => {
    expect(tagSuggestions(pool, "pe", [])).toEqual(["Permaculture", "Pet care", "Carpentry"]);
    expect(tagSuggestions(pool, "c", [])).toEqual(["Cooking", "Carpentry", "Permaculture", "Pet care"]);
  });
  it("leaves out what's already chosen, in any case", () => {
    expect(tagSuggestions(pool, "perma", ["PERMACULTURE"])).toEqual([]);
  });
  it("respects the limit", () => {
    expect(tagSuggestions(pool, "p", [], 2)).toHaveLength(2);
  });
  it("on a tie prefers the capitalised form", () => {
    expect(tagSuggestions(["yoga", "Yoga"], "yo", [])).toEqual(["Yoga"]);
  });
});

describe("canonicalTag", () => {
  const pool = ["Permaculture", "permaculture", "Permaculture"];
  it("uses the form others use, any case", () => {
    expect(canonicalTag("permaculture", pool)).toBe("Permaculture");
    expect(canonicalTag("  PERMACULTURE ", pool)).toBe("Permaculture");
  });
  it("keeps something new as typed, trimmed", () => expect(canonicalTag("  Welding ", pool)).toBe("Welding"));
});

describe("languages", () => {
  it("accepts a good list", () => {
    expect(validateLanguages([{ code: "en", level: 5 }, { code: "es", level: 3 }])).toBeNull();
    expect(validateLanguages([])).toBeNull();
  });
  it("refuses an unknown code, a repeat, a bad level and too many", () => {
    expect(validateLanguages([{ code: "xx", level: 5 }])).toMatch(/from the list/);
    expect(validateLanguages([{ code: "en", level: 5 }, { code: "en", level: 2 }])).toMatch(/English is listed twice/);
    expect(validateLanguages([{ code: "en", level: 6 as never }])).toMatch(/English/);
    expect(validateLanguages([{ code: "en", level: 0 as never }])).toMatch(/English/);
    const many = LANGUAGE_CODES.slice(0, MAX_LANGUAGES + 1).map((code) => ({ code, level: 3 as const }));
    expect(validateLanguages(many)).toMatch(/10/);
    expect(validateLanguages(many.slice(0, MAX_LANGUAGES))).toBeNull();
  });
  it("names a language and itself, falling back to the code", () => {
    expect(languageName("es")).toBe("Spanish");
    expect(languageEndonym("es")).toBe("Español");
    expect(languageName("zz")).toBe("zz");
    expect(languageEndonym("zz")).toBe("zz");
  });
  it("levels are 1 to 5", () => {
    expect([0, 1, 5, 6, "3", null].map(isLanguageLevel)).toEqual([false, true, true, false, false, false]);
  });
});
