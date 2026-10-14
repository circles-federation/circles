"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { Select } from "@/components/shared";
import { LANGUAGE_CODES, LANGUAGE_LEVELS, MAX_LANGUAGES, languageEndonym, languageName } from "@/lib/languages.util";
import type { MemberLanguage } from "@/lib/types";
import { LanguageLevelBar } from "./language-level";

// what a newly added language starts at, until they say otherwise
const STARTING_LEVEL = 3;

/* Edit myself's languages: each one in its own name with its English name
   under it, a level chosen by tapping its bar, and a remove button; then a
   list of the rest to add from, by English name. */
export function LanguagesEditor({ value, onChange }: { value: MemberLanguage[]; onChange: (next: MemberLanguage[]) => void }) {
  const remaining = LANGUAGE_CODES.filter((code) => !value.some((l) => l.code === code)).sort((a, b) => languageName(a).localeCompare(languageName(b), "en"));

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-3 border-t border-ink">
          {value.map((l) => {
            const endonym = languageEndonym(l.code);
            const english = languageName(l.code);
            return (
              <div key={l.code} className="flex items-center gap-3 border-b border-faint py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-sans text-base font-bold">{endonym}</div>
                  <div className="truncate font-serif text-sm text-soft">
                    {endonym === english ? LANGUAGE_LEVELS[l.level] : `${english} · ${LANGUAGE_LEVELS[l.level]}`}
                  </div>
                </div>
                <LanguageLevelBar level={l.level} language={english} onChange={(level) => onChange(value.map((x) => (x.code === l.code ? { ...x, level } : x)))} />
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x.code !== l.code))}
                  aria-label={`Remove ${english}`}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-soft hover:text-ink"
                >
                  <XMarkIcon className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {value.length < MAX_LANGUAGES && (
        <Select
          aria-label="Add a language"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...value, { code: e.target.value, level: STARTING_LEVEL }]);
          }}
          className="min-[720px]:max-w-90"
        >
          <option value="">Add a language…</option>
          {remaining.map((code) => {
            const english = languageName(code);
            const endonym = languageEndonym(code);
            return <option key={code} value={code}>{endonym === english ? english : `${english} — ${endonym}`}</option>;
          })}
        </Select>
      )}
    </div>
  );
}
