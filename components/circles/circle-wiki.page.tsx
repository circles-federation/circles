"use client";

import { useState } from "react";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import { Button, ConfirmModal, Input, Label, PageContainer, Section, SectionGroup, TextArea } from "@/components/shared";
import { EditableTags } from "@/components/profile/editable-tags";
import { circleDomainEnding, circleTypeNoun, circleWebsiteUrl } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";

// matches circle.page.tsx's read-only facts grid (label above a bold value,
// evenly split columns) — kept fixed at 4 slots since that's what the
// reference display grid assumes today.
const FACT_SLOTS = 4;

interface FactDraft {
  label: string;
  value: string;
}

interface HourDraft {
  day: string;
  time: string;
}

interface CircleWikiPageProps {
  circle: Circle;
  // the wiki's fields, edited freely
  onSave: (patch: Partial<Circle>) => void;
  onBack: () => void;
}

/* Manage circle → Wiki: everything the circle page's Wiki tab shows, in the
   same order (quick facts, About, offers and needs, visiting, joining).
   Unlike Details and Roles it's any member's to edit, so Save saves it. */
export function CircleWikiPage({ circle: o, onSave, onBack }: CircleWikiPageProps) {
  const [about, setAbout] = useState(o.about);
  const [offers, setOffers] = useState([...o.offers]);
  const [needs, setNeeds] = useState([...o.needs]);
  const [facts, setFacts] = useState<FactDraft[]>(() =>
    Array.from({ length: FACT_SLOTS }, (_, i) => {
      const [label, value] = o.facts[i] || ["", ""];
      return { label, value };
    })
  );
  // blank slots (no label and no value) are dropped rather than saved as
  // empty facts — this also lets a circle end up with fewer than 4 facts,
  // which circle.page.tsx's display grid already handles (it sizes its
  // columns from facts.length rather than assuming 4).
  const factPairs = facts
    .map((f): [string, string] => [f.label.trim(), f.value.trim()])
    .filter(([label, value]) => label || value);
  const [join, setJoin] = useState(o.join || "");
  const [contact, setContact] = useState(o.contact || "");
  const [website, setWebsite] = useState(o.website || "");
  const [address, setAddress] = useState(o.address || "");
  const [hours, setHours] = useState<HourDraft[]>(() => (o.hours || []).map(([day, time]) => ({ day, time })));
  // same drop-blank-rows treatment as facts, letting a circle end up with
  // fewer (or zero) hours rows than it started with.
  const hoursPairs = hours
    .map((h): [string, string] => [h.day.trim(), h.time.trim()])
    .filter(([day, time]) => day || time);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const dirty =
    about !== o.about ||
    offers.join("\u0000") !== o.offers.join("\u0000") ||
    needs.join("\u0000") !== o.needs.join("\u0000") ||
    JSON.stringify(factPairs) !== JSON.stringify(o.facts) ||
    join.trim() !== (o.join || "") ||
    contact.trim() !== (o.contact || "") ||
    website.trim() !== (o.website || "") ||
    address.trim() !== (o.address || "") ||
    JSON.stringify(hoursPairs) !== JSON.stringify(o.hours || []);

  function updateFact(i: number, key: keyof FactDraft, value: string) {
    setFacts((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: value } : f)));
  }

  function updateHour(i: number, key: keyof HourDraft, value: string) {
    setHours((prev) => prev.map((h, j) => (j === i ? { ...h, [key]: value } : h)));
  }

  function handleSave() {
    onSave({ about: about.trim(), offers, needs, facts: factPairs, join: join.trim(), contact: contact.trim(), website: website.trim(), address: address.trim(), hours: hoursPairs });
    onBack();
  }

  useBackHandler(dirty ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: "Save", icon: CheckIcon, onAction: handleSave, disabled: !dirty, variant: "primary" });

  return (
    <PageContainer size="normal">
      <p className="max-w-[42em] font-serif text-sm leading-normal text-soft">
        You&rsquo;re editing {o.name}&rsquo;s wiki as a member. Changes are visible to everyone, and your name will show as the last editor.
      </p>

      {/* the quick facts open the wiki, as they do on the circle's page:
          before the sections rather than one of them, since the box ends on
          its own ink rule and needs no hairline after it */}
      <div className="pt-8">
        <Label>Quick facts</Label>
        <div className="grid grid-cols-1 border border-ink min-[720px]:grid-cols-4">
          {facts.map((f, i) => (
            <div key={i} className={clsx("p-3.5", i < facts.length - 1 && "border-b border-faint min-[720px]:border-r min-[720px]:border-b-0")}>
              <input
                value={f.label}
                onChange={(e) => updateFact(i, "label", e.target.value)}
                placeholder="Label"
                aria-label={`Fact ${i + 1} label`}
                className="w-full border border-faint bg-paper px-2 py-1.5 font-sans text-micro font-bold uppercase tracking-[0.15em] text-soft outline-none focus:border-ink touch:text-base touch:tracking-[0.06em]"
              />
              <input
                value={f.value}
                onChange={(e) => updateFact(i, "value", e.target.value)}
                placeholder="Value"
                aria-label={`Fact ${i + 1} value`}
                className="mt-2 w-full border border-faint bg-paper px-2 py-1.5 font-sans text-lg font-extrabold tracking-tight text-ink outline-none focus:border-ink"
              />
            </div>
          ))}
        </div>
      </div>

      <SectionGroup>
        <Section>
          <Label htmlFor="wiki-about">About</Label>
          <TextArea
            id="wiki-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder={`Write a short description of your ${circleTypeNoun(o.type)}, its purpose, and what it does.`}
            rows={5}
          />
        </Section>

        <Section>
          <Label>What we offer</Label>
          <EditableTags values={offers} onChange={setOffers} placeholder="Add an offering and press Enter" />
        </Section>

        <Section>
          <Label>What we need</Label>
          <EditableTags values={needs} onChange={setNeeds} placeholder="Add a need and press Enter" />
        </Section>

        <Section>
          <div className="flex flex-col gap-5.5">
            <div>
              <Label htmlFor="wiki-website">Website</Label>
              <Input id="wiki-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={`yourorg.${circleDomainEnding(o.type)}`} />
              {website.trim() && !circleWebsiteUrl(website) && (
                <p className="mt-2 font-serif text-sm leading-normal text-soft">That isn&rsquo;t a web address, so it&rsquo;ll show as text rather than a link.</p>
              )}
            </div>

            <div>
              <Label htmlFor="wiki-address">Address</Label>
              <Input id="wiki-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Providence, RI" />
            </div>

            <div>
              <Label>Open hours</Label>
              <div className="flex flex-col gap-2.5">
                {hours.map((h, i) => (
                  <div key={i} className="flex items-stretch border border-ink">
                    <input
                      value={h.day}
                      onChange={(e) => updateHour(i, "day", e.target.value)}
                      placeholder="Day (e.g. Tue or Mon–Fri)"
                      className="min-w-0 flex-1 border-0 border-r border-ink px-3 py-2.75 font-serif text-base outline-none"
                    />
                    <input
                      value={h.time}
                      onChange={(e) => updateHour(i, "time", e.target.value)}
                      placeholder="Hours (e.g. 4–8pm)"
                      className="min-w-0 flex-1 border-0 border-r border-ink px-3 py-2.75 font-serif text-base outline-none"
                    />
                    <button
                      onClick={() => setHours((prev) => prev.filter((_, j) => j !== i))}
                      aria-label="Remove"
                      className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-paper px-3.5 text-soft"
                    >
                      <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="compact" onClick={() => setHours((prev) => [...prev, { day: "", time: "" }])} className="self-start">
                  <PlusIcon className="size-3.5" strokeWidth={2.5} />
                  Add hours
                </Button>
              </div>
            </div>
          </div>
        </Section>

        <Section>
          <div className="flex flex-col gap-5.5">
            <div>
              <Label htmlFor="wiki-join">How to join</Label>
              <TextArea
                id="wiki-join"
                value={join}
                onChange={(e) => setJoin(e.target.value)}
                placeholder={`How does someone become part of this ${circleTypeNoun(o.type)}?`}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="wiki-contact">Get in touch</Label>
              <Input id="wiki-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={`hello@yourorg.${circleDomainEnding(o.type)}`} />
            </div>
          </div>
        </Section>
      </SectionGroup>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to the wiki. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onBack}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
