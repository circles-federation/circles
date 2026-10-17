import type { LanguageLevel, MemberLanguage } from "./types";

/* The languages a member speaks, each with how well, as pure rules shared by
   Edit myself (instant feedback), the profile page and lib/db/members.ts (the
   real check). A language is a BCP 47 code with two names: its English name,
   and its name for itself ("Español", "ខ្មែរ"). The names are kept here
   rather than asked of the runtime's Intl.DisplayNames, which differs from
   one to the next (Chrome has no name for ASL and few languages' own names;
   Safari and Node disagree on several), so the server's list and a browser's
   would never match. No flags: a flag stands for a country, not a language
   (English, Spanish and Portuguese each have several; Haitian Creole and ASL
   have none). */

// what can be picked, with its English name and its own: widely spoken
// languages, plus those common in Providence's neighborhoods (Cape Verdean
// Creole, Haitian Creole, Khmer, Hmong, Lao), American Sign Language and
// Esperanto. Where a language has no name of its own apart from English
// (ASL), the two are the same.
const LANGUAGES = {
  en: ["English", "English"],
  es: ["Spanish", "Español"],
  pt: ["Portuguese", "Português"],
  kea: ["Cape Verdean Creole", "Kabuverdianu"],
  ht: ["Haitian Creole", "Kreyòl ayisyen"],
  fr: ["French", "Français"],
  it: ["Italian", "Italiano"],
  de: ["German", "Deutsch"],
  pl: ["Polish", "Polski"],
  ru: ["Russian", "Русский"],
  uk: ["Ukrainian", "Українська"],
  el: ["Greek", "Ελληνικά"],
  ga: ["Irish", "Gaeilge"],
  he: ["Hebrew", "עברית"],
  yi: ["Yiddish", "ייִדיש"],
  ar: ["Arabic", "العربية"],
  fa: ["Persian", "فارسی"],
  tr: ["Turkish", "Türkçe"],
  so: ["Somali", "Soomaali"],
  sw: ["Swahili", "Kiswahili"],
  am: ["Amharic", "አማርኛ"],
  yo: ["Yoruba", "Èdè Yorùbá"],
  hi: ["Hindi", "हिन्दी"],
  bn: ["Bengali", "বাংলা"],
  ur: ["Urdu", "اردو"],
  pa: ["Punjabi", "ਪੰਜਾਬੀ"],
  ne: ["Nepali", "नेपाली"],
  zh: ["Chinese", "中文"],
  yue: ["Cantonese", "粵語"],
  ja: ["Japanese", "日本語"],
  ko: ["Korean", "한국어"],
  vi: ["Vietnamese", "Tiếng Việt"],
  km: ["Khmer", "ខ្មែរ"],
  lo: ["Lao", "ລາວ"],
  th: ["Thai", "ไทย"],
  hmn: ["Hmong", "Hmoob"],
  tl: ["Tagalog", "Tagalog"],
  id: ["Indonesian", "Bahasa Indonesia"],
  ase: ["American Sign Language", "American Sign Language"],
  eo: ["Esperanto", "Esperanto"],
} as const satisfies Record<string, readonly [string, string]>;

type LanguageCode = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];
const isLanguageCode = (code: string): code is LanguageCode => code in LANGUAGES;

export const MAX_LANGUAGES = 10;

// the five steps, for screen readers and the editor's hint — never shown as numbers
export const LANGUAGE_LEVELS: Record<LanguageLevel, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Conversational",
  4: "Fluent",
  5: "Native",
};

// its English name (the code itself for one that's no longer on the list)
export function languageName(code: string): string {
  return isLanguageCode(code) ? LANGUAGES[code][0] : code;
}

// its name for itself
export function languageEndonym(code: string): string {
  return isLanguageCode(code) ? LANGUAGES[code][1] : languageName(code);
}

export function isLanguageLevel(value: unknown): value is LanguageLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

// the first problem with a list, or null when it's fine
export function validateLanguages(list: MemberLanguage[]): string | null {
  if (list.length > MAX_LANGUAGES) return `Keep it to ${MAX_LANGUAGES} languages or fewer.`;
  const seen = new Set<string>();
  for (const l of list) {
    if (!isLanguageCode(l.code)) return "Pick a language from the list.";
    if (seen.has(l.code)) return `${languageName(l.code)} is listed twice.`;
    seen.add(l.code);
    if (!isLanguageLevel(l.level)) return `Choose how well you speak ${languageName(l.code)}.`;
  }
  return null;
}
