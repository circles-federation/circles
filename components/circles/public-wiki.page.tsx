"use client";

import Link from "next/link";
import type { PublicWiki } from "@/lib/types";
import { CircleWiki } from "./circle-wiki";

/* A circle's wiki for anyone, signed in or not (/wiki/[id]): the Circles
   wordmark, then the wiki as members see it (CircleWiki), without who last
   edited it, its Message square writing to it without an account while its
   Inbox is on (/wiki/[id]/write), its sub-circles linking to their own public
   pages, and at the foot, how to join Circles or sign in. Built from
   PublicWiki alone, so nothing about the circle's members reaches it. */
export function PublicWikiPage({ wiki }: { wiki: PublicWiki }) {
  return (
    <div className="min-h-dvh bg-paper px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-220">
        <Link href="/" className="font-sans text-sm font-extrabold tracking-heading text-ink no-underline">
          Circles
        </Link>
        <div className="mt-8">
          <CircleWiki
            circle={wiki}
            {...(wiki.inbox ? { writeHref: `/wiki/${wiki.id}/write` } : {})}
            {...(wiki.parent ? { parent: { name: wiki.parent.name, tone: wiki.parent.isCity ? "federation" : "plain" } } : {})}
            {...(wiki.subCircles.length > 0
              ? {
                  subCircles: wiki.subCircles.map((s) => (
                    <Link key={s.id} href={`/wiki/${s.id}`} className="ink-press flex flex-col border-r border-b border-ink bg-paper p-6 text-ink no-underline">
                      <span className="font-sans text-xl leading-none font-extrabold tracking-heading">{s.name}</span>
                      <span className="mt-3 font-serif text-sm leading-[1.4] text-body">{s.tagline}</span>
                    </Link>
                  )),
                }
              : {})}
          />
        </div>

        <footer className="mt-12 border-t border-ink pt-6">
          <p className="max-w-[36em] font-serif text-base leading-normal text-body">
            {wiki.name} is on Circles, where neighbors in Providence organize together.
          </p>
          <p className="mt-3 font-sans text-sm">
            <Link href="/join" className="font-bold text-ink underline underline-offset-2">
              Join
            </Link>
            <span className="text-soft"> · </span>
            <Link href="/" className="font-bold text-ink underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
