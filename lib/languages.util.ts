import type { LanguageLevel, MemberLanguage } from "./types";

/* The languages a member speaks, each with how well, as pure rules shared by
   Edit myself (instant feedback), the profile page and lib/db/members.ts (the
   real check). A language is a BCP 47 code, and its names come from the
   runtime's own Intl.DisplayNames — the English name, and the language's name
   for itself ("Español", "ខ្មែរ") — so there's no list of names to keep. No
   flags: a flag stands for a country, not a language (English, Spanish and
   Portuguese each have several; Haitian Creole and ASL have none). */

// what can be picked: widely spoken languages, plus those common in
// Providence's neighborhoods (Cape Verdean Creole, Haitian Creole, Khmer,
// Hmong, Lao), American Sign Language and Esperanto
export const LANGUAGE_CODES = [
  "en", "es", "pt", "kea", "ht", "fr", "it", "de", "pl", "ru", "uk", "el", "ga", "he", "yi", "ar", "fa", "tr", "so", "sw", "am", "yo",
  "hi", "bn", "ur", "pa", "ne", "zh", "yue", "ja", "ko", "vi", "km", "lo", "th", "hmn", "tl", "id", "ase", "eo",
] as const;

export const MAX_LANGUAGES = 10;

// the five steps, for screen readers and the editor's hint — never shown as numbers
export const LANGUAGE_LEVELS: Record<LanguageLevel, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Conversational",
  4: "Fluent",
  5: "Native",
};

const english = new Intl.DisplayNames(["en"], { type: "language" });

// where the runtime's English name isn't the one English speakers use
const ENGLISH_NAMES: Record<string, string> = { kea: "Cape Verdean Creole" };

export function languageName(code: string): string {
  return ENGLISH_NAMES[code] ?? english.of(code) ?? code;
}

// the language's name for itself, or its English name where the runtime has none
export function languageEndonym(code: string): string {
  try {
    const own = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return own ? own.charAt(0).toLocaleUpperCase(code) + own.slice(1) : languageName(code);
  } catch {
    return languageName(code);
  }
}

export function isLanguageLevel(value: unknown): value is LanguageLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

// the first problem with a list, or null when it's fine
export function validateLanguages(list: MemberLanguage[]): string | null {
  if (list.length > MAX_LANGUAGES) return `Keep it to ${MAX_LANGUAGES} languages or fewer.`;
  const seen = new Set<string>();
  for (const l of list) {
    if (!(LANGUAGE_CODES as readonly string[]).includes(l.code)) return "Pick a language from the list.";
    if (seen.has(l.code)) return `${languageName(l.code)} is listed twice.`;
    seen.add(l.code);
    if (!isLanguageLevel(l.level)) return `Choose how well you speak ${languageName(l.code)}.`;
  }
  return null;
}
