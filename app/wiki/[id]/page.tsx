import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { PublicWikiPage } from "@/components/circles/public-wiki.page";
import { getPublicWiki } from "@/lib/db/circles";
import { getCurrentUserId } from "@/lib/session";

// the same wiki is read by the page and its metadata, in one request
const loadWiki = cache(getPublicWiki);

const appUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/* What a search result and a link preview say (iMessage, WhatsApp, Slack
   read these when the link is pasted into a message): the circle and its
   tagline. Search engines may list it, found by its links (a circle's own
   website, its sub-circles' pages), with this address as the one to list. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const wiki = await loadWiki(id);
  const base: Metadata = { metadataBase: new URL(appUrl) };
  if (!wiki) return { ...base, robots: { index: false, follow: false } };
  return {
    ...base,
    robots: { index: true, follow: true },
    alternates: { canonical: `/wiki/${wiki.id}` },
    title: `${wiki.name} · Circles`,
    description: wiki.tagline,
    openGraph: { type: "website", siteName: "Circles", title: wiki.name, description: wiki.tagline },
    twitter: { card: "summary", title: wiki.name, description: wiki.tagline },
  };
}

export const dynamic = "force-dynamic";

// a circle's wiki for anyone, signed in or not (proxy.ts lets /wiki/ through).
// A member is sent to it in the app, where it's the same and more.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wiki = await loadWiki(id);
  if (!wiki) notFound();
  if (await getCurrentUserId()) redirect(`/circles/${id}/wiki`);
  return <PublicWikiPage wiki={wiki} />;
}
