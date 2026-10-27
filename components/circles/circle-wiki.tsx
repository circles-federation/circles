"use client";

import { useSyncExternalStore, type ComponentType, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { EnvelopeIcon, GlobeAltIcon, MapIcon, PencilSquareIcon, PhoneIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Eyebrow, EyebrowGroup, CappedChip, PrivateLabel, Section, SectionGroup, Tag, type ChipTone } from "@/components/shared";
import { CIRCLE_TYPE_LABEL, circleContact, circleWebsiteUrl, isGroup } from "@/lib/circles.util";
import { mapsPlatform, mapsUrl, type MapsPlatform } from "@/lib/maps.util";
import type { Circle } from "@/lib/types";

// what a circle's wiki shows, the same in the app and on its public page
export type WikiCircle = Pick<Circle, "name" | "type" | "tagline" | "facts" | "about" | "offers" | "needs" | "website" | "address" | "contact" | "hours" | "join">;

interface CircleWikiProps {
  circle: WikiCircle;
  // where it sits: its parent, as the masthead's chip, opening it where it
  // can (in the app), coloured as given where there's no member to colour it
  // by (its public page)
  parent?: { name: string; onOpen?: () => void; tone?: ChipTone };
  // who last edited it, in the app (its public page doesn't say)
  lastEdited?: ReactNode;
  // its sub-circles, as each place draws them (cards in the app, links on
  // the public page); none, and there's no section
  subCircles?: ReactNode;
  // writing to it, while its Inbox is on: in the app for anyone outside it,
  // and on its public page for anyone at all
  writeHref?: string;
}

/* A circle's wiki: its masthead (what it is, where it sits, its tagline),
   its quick facts right under it, then about, what it offers and needs,
   where to find it (its website, address and contact as coloured squares,
   opening each), its open hours, how to join, and last its circles. The
   circle page's Wiki section and its public page (/wiki/[id]) both draw it,
   the app adding who last edited it. Needs no member
   or app state, so it works for someone signed out. */
export function CircleWiki({ circle: c, parent, lastEdited, subCircles, writeHref }: CircleWikiProps) {
  const websiteUrl = c.website ? circleWebsiteUrl(c.website) : null;
  const contact = c.contact ? circleContact(c.contact) : null;
  const ruled = c.facts.length === 0;

  return (
    <>
      <div className={clsx("pb-6", ruled && "border-b border-ink")}>
        {/* where it sits in the tree: its parent, as a chip opposite the type */}
        <div className="flex items-center justify-between gap-3">
          <Eyebrow className="shrink-0 text-soft">
            {isGroup(c) ? <PrivateLabel>{CIRCLE_TYPE_LABEL[c.type]}</PrivateLabel> : CIRCLE_TYPE_LABEL[c.type]}
          </Eyebrow>
          {parent && (
            <CappedChip title={`Part of ${parent.name}`} {...(parent.onOpen ? { onClick: parent.onOpen } : {})} {...(parent.tone ? { tone: parent.tone } : {})}>
              {parent.name}
            </CappedChip>
          )}
        </div>
        <h1 className="mt-3 font-sans text-title leading-[0.92] font-extrabold tracking-display">{c.name}</h1>
        <p className="mt-4 font-serif text-xl text-body italic">{c.tagline}</p>
        {lastEdited}
      </div>

      {/* its quick facts right under the masthead, as a small table: each
          fact's own label is its heading. Before the sections rather than one
          of them, since it ends on its own ink rule and needs no hairline
          after it */}
      {c.facts.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-y border-ink bg-faint min-[720px]:grid-cols-4">
          {c.facts.map(([k, v]) => (
            <div key={k} className="bg-paper px-4 py-4">
              <Eyebrow className="text-soft">{k}</Eyebrow>
              <div className="mt-2 font-sans text-lg font-extrabold tracking-snug">{v}</div>
            </div>
          ))}
        </div>
      )}

      <SectionGroup>
        <Section>
          <EyebrowGroup label="About">
            <p className="max-w-[40em] font-serif text-lg leading-[1.55]">{c.about}</p>
          </EyebrowGroup>
        </Section>

        {c.offers.length > 0 && (
          <Section>
            <EyebrowGroup label="What they offer">
              {c.offers.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </EyebrowGroup>
          </Section>
        )}

        {c.needs.length > 0 && (
          <Section>
            <EyebrowGroup label="What they need">
              {c.needs.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </EyebrowGroup>
          </Section>
        )}

        {/* where to find it online, in person and to get in touch: a square
            each, opening its website, its address in the visitor's maps app,
            or an email or a call to it, and in the app, writing to it */}
        {(c.website || c.address || c.contact || writeHref) && (
          <Section>
            <div className="flex flex-wrap gap-3 min-[720px]:gap-x-10 min-[720px]:gap-y-4">
              {websiteUrl ? (
                <VisitLink href={websiteUrl.href} newTab icon={GlobeAltIcon} tone="action" label="Website" value={websiteUrl.hostname.replace(/^www\./, "")} />
              ) : c.website ? (
                // not an address it can link to (an Instagram handle, say),
                // so shown as typed rather than dropped
                <div className="min-w-0">
                  <Eyebrow className="text-soft">Website</Eyebrow>
                  <div className="mt-1 font-serif text-base leading-[1.35] wrap-break-word text-body">{c.website}</div>
                </div>
              ) : null}
              {c.address && <MapsLink address={c.address} />}
              {contact ? (
                <VisitLink
                  href={contact.href}
                  newTab={false}
                  icon={contact.kind === "email" ? EnvelopeIcon : PhoneIcon}
                  tone={contact.kind}
                  label={contact.kind === "email" ? "Email" : "Phone"}
                  value={contact.display}
                />
              ) : c.contact ? (
                // not an email or a number, so shown as typed
                <div className="min-w-0">
                  <Eyebrow className="text-soft">Get in touch</Eyebrow>
                  <div className="mt-1 font-serif text-base leading-[1.35] wrap-break-word text-body">{c.contact}</div>
                </div>
              ) : null}
              {writeHref && <VisitLink href={writeHref} internal icon={PencilSquareIcon} tone="ink" label="Message" value={`Write to ${c.name}`} />}
            </div>
          </Section>
        )}

        {c.hours && c.hours.length > 0 && (
          <Section>
            <EyebrowGroup label="Open hours">
              <div className="max-w-90">
                {c.hours.map(([d, t]) => (
                  <div key={d} className="flex justify-between gap-3 border-b border-faint py-2 font-serif text-base text-body last:border-b-0">
                    <span className="text-soft">{d}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </EyebrowGroup>
          </Section>
        )}

        {c.join && (
          <Section>
            <EyebrowGroup label="How to join">
              <p className="max-w-[40em] font-serif text-base leading-normal text-body">{c.join}</p>
            </EyebrowGroup>
          </Section>
        )}

        {/* last, since there may be many and they'd push how to reach and
            join it down the page */}
        {subCircles && (
          <Section>
            <Eyebrow className="text-soft">Circles</Eyebrow>
            {/* the grid's own border-t is the header rule, as on the Members tab */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] border-t border-l border-ink">{subCircles}</div>
          </Section>
        )}
      </SectionGroup>
    </>
  );
}

const noSubscribe = () => () => {};
const currentMapsPlatform = (): MapsPlatform => mapsPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

// a circle's address, opening it in the visitor's maps app (see
// lib/maps.util.ts); Google Maps on the web until the browser says which
// device it is
function MapsLink({ address }: { address: string }) {
  const platform = useSyncExternalStore(noSubscribe, currentMapsPlatform, () => "web" as const);
  const href = mapsUrl(address, platform);
  return (
    <VisitLink
      href={href}
      // a geo: link opens an app on the phone itself, not a new tab
      newTab={!href.startsWith("geo:")}
      icon={MapIcon}
      tone="leaf"
      label="Address"
      // the street, then the rest ("Providence, RI") on a line of its own
      value={(() => {
        const [street, ...rest] = address.split(",").map((part) => part.trim());
        return (
          <>
            <span className="block">{street}</span>
            {rest.length > 0 && <span className="block">{rest.join(", ")}</span>}
          </>
        );
      })()}
      // its visible label first, so voice control can say "click Address"
      name={`Address: ${address}`}
    />
  );
}

const VISIT_TONE = {
  ink: "border-ink bg-ink [--press-color:var(--color-ink)]",
  action: "border-action bg-action [--press-color:var(--color-action)]",
  leaf: "border-leaf bg-leaf [--press-color:var(--color-leaf)]",
  phone: "border-phone bg-phone [--press-color:var(--color-phone)]",
  email: "border-email bg-email [--press-color:var(--color-email)]",
};

/* A filled square with an icon, for one way to reach a circle (its website,
   its address), opening it. On a phone just the square; from the desktop
   breakpoint, what it opens beside it, all one link. Pressed, the square
   inverts (fill-press). */
function VisitLink({ href, newTab, internal, icon: Icon, tone, label, value, name }: { href: string; newTab?: boolean; internal?: boolean; icon: ComponentType<SVGProps<SVGSVGElement>>; tone: keyof typeof VISIT_TONE; label: string; value: ReactNode; name?: string }) {
  const plain = typeof value === "string" ? value : undefined;
  // a page of the app's own (writing to it) goes by the router
  const Anchor = internal ? Link : "a";
  return (
    <Anchor
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={name ?? `${label}: ${plain}`}
      title={plain ?? name}
      className="fill-press flex items-start gap-4 text-ink no-underline"
    >
      <span className={clsx("fill-press-square flex size-16 shrink-0 items-center justify-center border-2 text-paper", VISIT_TONE[tone])}>
        <Icon className="size-8" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="hidden min-w-0 min-[720px]:block" aria-hidden>
        <Eyebrow className="text-soft">{label}</Eyebrow>
        <div className="mt-1 font-serif text-base leading-[1.35] text-body">{value}</div>
      </div>
    </Anchor>
  );
}
