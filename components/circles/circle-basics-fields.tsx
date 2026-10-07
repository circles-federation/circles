"use client";

import type { ReactNode } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Label, TextArea } from "@/components/shared";
import { CIRCLE_AIM_MAX, CIRCLE_DOMAIN_MAX, MAX_CIRCLE_AIMS } from "@/lib/circles.util";

interface CircleBasicsFieldsProps {
  domain: string;
  onDomainChange: (domain: string) => void;
  // one row each, kept as typed (blank rows are dropped when it's saved)
  aims: string[];
  onAimsChange: (aims: string[]) => void;
  disabled?: boolean;
  // a problem with either, shown under it
  domainError?: ReactNode;
  aimsError?: ReactNode;
}

/* A Circle's domain (the area it decides in) and aims (what it's there to
   achieve), as sociocracy defines one: on New circle, and on Manage circle's
   Circle tab, shown while the type is Circle. Each field's wrapper has the id
   a form scrolls to when its problem is about it (field-domain, field-aims). */
export function CircleBasicsFields({ domain, onDomainChange, aims, onAimsChange, disabled, domainError, aimsError }: CircleBasicsFieldsProps) {
  return (
    <>
      <div id="field-domain">
        <Label htmlFor="circle-domain">Domain</Label>
        <p className="mb-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">The area this circle has the authority to decide in.</p>
        <TextArea
          id="circle-domain"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          disabled={disabled}
          maxLength={CIRCLE_DOMAIN_MAX}
          rows={3}
          placeholder="e.g. The block's shared budget: what it's spent on, and how"
        />
        {domainError}
      </div>

      <div id="field-aims">
        <Label>Aims</Label>
        <p className="mb-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">What this circle is there to achieve. At least one.</p>
        <div className="flex flex-col gap-2.5">
          {aims.map((a, i) => (
            <div key={i} className="flex items-stretch border border-ink">
              <input
                value={a}
                onChange={(e) => onAimsChange(aims.map((x, j) => (j === i ? e.target.value : x)))}
                disabled={disabled}
                maxLength={CIRCLE_AIM_MAX}
                placeholder={i === 0 ? "e.g. Keep the block's money transparent" : "Another aim"}
                aria-label={`Aim ${i + 1}`}
                className="min-w-0 flex-1 border-0 px-3 py-2.75 font-serif text-base outline-none"
              />
              {aims.length > 1 && (
                <button
                  onClick={() => onAimsChange(aims.filter((_, j) => j !== i))}
                  disabled={disabled}
                  aria-label={`Remove aim ${i + 1}`}
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 border-l border-ink bg-paper px-3.5 text-soft"
                >
                  <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}
          {aims.length < MAX_CIRCLE_AIMS && (
            <Button variant="secondary" size="compact" onClick={() => onAimsChange([...aims, ""])} disabled={disabled} className="self-start">
              <PlusIcon className="size-3.5" strokeWidth={2.5} />
              Add aim
            </Button>
          )}
        </div>
        {aimsError}
      </div>
    </>
  );
}
