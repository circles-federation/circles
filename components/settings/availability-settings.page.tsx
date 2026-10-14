"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import clsx from "clsx";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import type { MutationResult } from "@/components/providers/app-state-provider";
import { Button, ConfirmModal, EyebrowGroup, Input, Label, PageContainer, Section, SectionGroup, useToast } from "@/components/shared";
import {
  AVAILABILITY_PRESETS,
  AVAILABILITY_STEP,
  DAY_END,
  MAX_AVAILABILITY_WINDOWS,
  dayRanges,
  fieldMinutes,
  hasPreset,
  matchesPreset,
  minutesClock,
  normalizeAvailability,
  sameAvailability,
  validateAvailability,
  type AvailabilityPreset,
} from "@/lib/availability.util";
import type { AvailabilityWindow } from "@/lib/types";

interface AvailabilitySettingsPageProps {
  // null until they've set it
  windows: AvailabilityWindow[] | null;
  onSave: (windows: AvailabilityWindow[]) => Promise<MutationResult>;
  onBack: () => void;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
// where the preview's hour marks fall, as a share of the day
const HOUR_MARKS = [
  { label: "6am", hour: 6 },
  { label: "12pm", hour: 12 },
  { label: "6pm", hour: 18 },
];

// a new window starts on an evening, with no days picked
const BLANK_WINDOW: AvailabilityWindow = { days: [], start: 18 * 60, end: 21 * 60 };

/* When a member can do meetings, set once from Settings and used by every
   meeting a circle of theirs plans: a few quick picks, a preview of the week,
   and the windows themselves, each some days and a time range (like one of
   iOS's sleep schedules). Like any form here, nothing changes until the top
   bar's Save, and Back asks before discarding. */
export function AvailabilitySettingsPage({ windows, onSave, onBack }: AvailabilitySettingsPageProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<AvailabilityWindow[]>(() => windows ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // overlapping or touching windows are fine: they're joined on save, so they
  // compare as the joined schedule
  const dirty = !sameAvailability(draft, windows ?? []);

  function edit(next: AvailabilityWindow[]) {
    setDraft(next);
    setError(null);
  }

  function changeWindow(index: number, patch: Partial<AvailabilityWindow>) {
    edit(draft.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  function togglePreset(preset: AvailabilityPreset) {
    if (hasPreset(draft, preset)) edit(draft.filter((w) => !matchesPreset(w, preset)));
    else edit([...draft, { ...preset.window, days: [...preset.window.days] }]);
  }

  async function handleSave() {
    const problem = validateAvailability(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(draft);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    showToast({ tone: "success", title: "Changes saved", message: "Your meeting availability has been updated." });
    onBack();
  }

  useBackHandler(dirty && !saving ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: saving ? "Saving" : "Save changes", icon: CheckIcon, onAction: handleSave, disabled: !dirty || saving, variant: "primary" });

  return (
    <PageContainer size="normal">
      <SectionGroup>
        {/* pt-0: the top bar's title (Meeting availability) is the page's only heading */}
        <Section className="pt-0">
          <p className="font-serif text-base leading-normal">When someone plans a meeting for a circle you&rsquo;re in, they&rsquo;ll see whether you can make it. Set it once here.</p>
          <p className="mt-2 font-serif text-sm leading-normal text-soft">Only members of your circles see it, and only whether you&rsquo;re free at the time being planned, never your schedule itself.</p>
        </Section>

        <Section>
          <EyebrowGroup label="Quick picks">
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_PRESETS.map((preset) => (
                <ToggleChip key={preset.key} pressed={hasPreset(draft, preset)} onClick={() => togglePreset(preset)} className="px-3 py-2.5 text-xs uppercase tracking-[0.04em]">
                  {preset.label}
                </ToggleChip>
              ))}
            </div>
          </EyebrowGroup>
        </Section>

        <Section>
          <EyebrowGroup label="Your week">
            <WeekPreview windows={draft} />
          </EyebrowGroup>
        </Section>

        <Section>
          <EyebrowGroup label="Windows">
            <div className="flex flex-col gap-3.5">
              {draft.map((w, index) => (
                <WindowEditor
                  key={index}
                  index={index}
                  window={w}
                  onChange={(patch) => changeWindow(index, patch)}
                  onRemove={() => edit(draft.filter((_, i) => i !== index))}
                />
              ))}
              {draft.length === 0 && <p className="font-serif text-sm leading-normal text-soft">No windows yet. Pick one above, or add your own.</p>}
              {draft.length < MAX_AVAILABILITY_WINDOWS && (
                <Button variant="secondary" size="compact" onClick={() => edit([...draft, { ...BLANK_WINDOW }])} className="self-start">
                  <PlusIcon className="size-3.5" strokeWidth={2.5} />
                  Add window
                </Button>
              )}
            </div>
          </EyebrowGroup>
        </Section>
      </SectionGroup>

      {error && (
        <p role="alert" className="mt-2 font-sans text-sm font-bold text-danger">
          {error}
        </p>
      )}

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to your meeting availability. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}

// a square, ruled toggle: ink-filled while it's picked
function ToggleChip({ pressed, onClick, className, children, ...rest }: { pressed: boolean; onClick: () => void; className?: string; children: ReactNode } & Omit<ComponentPropsWithoutRef<"button">, "onClick">) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={clsx("cursor-pointer border border-ink font-sans font-bold", pressed ? "bg-ink text-paper" : "bg-paper text-ink", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// one window: the days it covers, then from and to
function WindowEditor({ index, window: w, onChange, onRemove }: { index: number; window: AvailabilityWindow; onChange: (patch: Partial<AvailabilityWindow>) => void; onRemove: () => void }) {
  const fromId = `window-${index}-from`;
  const toId = `window-${index}-to`;

  function toggleDay(day: number) {
    onChange({ days: w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day].sort((a, b) => a - b) });
  }

  return (
    <div className="border border-ink p-3.5">
      <div role="group" aria-label={`Days for window ${index + 1}`} className="grid grid-cols-7 gap-1.5">
        {DAY_INITIALS.map((initial, day) => (
          <ToggleChip key={day} pressed={w.days.includes(day)} onClick={() => toggleDay(day)} aria-label={DAY_NAMES[day]} className="h-10 text-sm">
            {initial}
          </ToggleChip>
        ))}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
        <div>
          <Label htmlFor={fromId}>From</Label>
          <Input id={fromId} type="time" step={AVAILABILITY_STEP * 60} value={minutesClock(w.start)} onChange={(e) => e.target.value && onChange({ start: fieldMinutes(e.target.value, false) })} />
        </div>
        <div>
          <Label htmlFor={toId}>To</Label>
          <Input id={toId} type="time" step={AVAILABILITY_STEP * 60} value={minutesClock(w.end)} onChange={(e) => e.target.value && onChange({ end: fieldMinutes(e.target.value, true) })} />
        </div>
      </div>
      <Button variant="danger" size="compact" onClick={onRemove} className="mt-3.5">
        Remove
      </Button>
    </div>
  );
}

/* The week at a glance, a bar for each day across its 24 hours (read-only; the
   windows below are what's edited). Overlapping windows show joined, as
   they're saved. */
function WeekPreview({ windows }: { windows: AvailabilityWindow[] }) {
  const joined = normalizeAvailability(windows);
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label={previewDescription(joined)}>
      <div className="relative ml-6 h-3 font-sans text-[10px] font-bold uppercase text-soft" aria-hidden>
        {HOUR_MARKS.map((mark) => (
          <span key={mark.hour} className="absolute -translate-x-1/2" style={{ left: `${(mark.hour / 24) * 100}%` }}>
            {mark.label}
          </span>
        ))}
      </div>
      {DAY_INITIALS.map((initial, day) => (
        <div key={day} className="flex items-center gap-2" aria-hidden>
          <span className="w-4 text-center font-sans text-xs font-bold">{initial}</span>
          <div className="relative h-4 flex-1 border border-ink">
            {HOUR_MARKS.map((mark) => (
              <span key={mark.hour} className="absolute inset-y-0 w-px bg-faint" style={{ left: `${(mark.hour / 24) * 100}%` }} />
            ))}
            {dayRanges(joined, day).map((r) => (
              <span key={r.start} className="absolute inset-y-0 bg-ink" style={{ left: `${(r.start / DAY_END) * 100}%`, width: `${((r.end - r.start) / DAY_END) * 100}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// the preview in words, for screen readers
function previewDescription(joined: AvailabilityWindow[]): string {
  if (joined.length === 0) return "No meeting times set.";
  const parts = joined.map((w) => `${w.days.map((d) => DAY_NAMES[d]).join(", ")}, ${minutesClock(w.start)} to ${minutesClock(w.end)}`);
  return `Available for meetings: ${parts.join("; ")}.`;
}
