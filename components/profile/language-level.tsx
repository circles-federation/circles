"use client";

import clsx from "clsx";
import { LANGUAGE_LEVELS } from "@/lib/languages.util";
import type { LanguageLevel } from "@/lib/types";

const STEPS: LanguageLevel[] = [1, 2, 3, 4, 5];

interface LanguageLevelProps {
  level: LanguageLevel;
  // set, the segments become buttons that choose the level
  onChange?: (level: LanguageLevel) => void;
  // whose, for the buttons' labels ("Spanish: Fluent")
  language: string;
}

/* How well someone speaks a language: five segments, filled up to their
   level, like a résumé's bar — never numbered. Read-only on a profile, and on
   Edit myself each segment is a button choosing that level. Screen readers get
   the level's word (Beginner … Native). */
export function LanguageLevelBar({ level, onChange, language }: LanguageLevelProps) {
  const segment = (step: LanguageLevel) => clsx("h-2.5 w-6", step <= level ? "bg-ink" : "bg-faint");
  if (!onChange) {
    return (
      <span role="img" aria-label={`${language}: ${LANGUAGE_LEVELS[level]}`} title={LANGUAGE_LEVELS[level]} className="flex shrink-0 gap-1">
        {STEPS.map((step) => <span key={step} className={segment(step)} />)}
      </span>
    );
  }
  return (
    <span role="radiogroup" aria-label={`How well you speak ${language}`} className="flex shrink-0 gap-1">
      {STEPS.map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={step === level}
          aria-label={LANGUAGE_LEVELS[step]}
          title={LANGUAGE_LEVELS[step]}
          onClick={() => onChange(step)}
          // the tap area is taller than the bar it shows
          className="flex h-8 cursor-pointer items-center border-0 bg-transparent p-0"
        >
          <span className={segment(step)} />
        </button>
      ))}
    </span>
  );
}
