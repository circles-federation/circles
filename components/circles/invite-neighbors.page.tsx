"use client";

import { useSyncExternalStore } from "react";
import { ArrowUpTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { useTopBarMenu } from "@/components/providers/top-bar-action-provider";
import { PageContainer, PrintSheet, useToast } from "@/components/shared";
import { printPage } from "@/lib/print";
import { shareOrCopy } from "@/lib/share";
import type { Circle } from "@/lib/types";
import { NeighborhoodPoster } from "./neighborhood-poster";

const noSubscribe = () => () => {};

interface InviteNeighborsPageProps {
  neighborhood: Circle;
  city: string;
}

/* Invite neighbors, from your own neighborhood's menu: its poster, to print
   for a mailroom or a noticeboard or to send the link it leads to. The top
   bar's menu does both: Print prints the poster alone, on a letter-size
   page (PrintSheet), and Share link sends the application, the
   neighborhood already chosen. */
export function InviteNeighborsPage({ neighborhood, city }: InviteNeighborsPageProps) {
  const { showToast } = useToast();
  // the link needs this site's own address, which only the browser knows here
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => null);
  const applyUrl = origin ? `${origin}/apply?neighborhood=${encodeURIComponent(neighborhood.id)}` : null;

  async function shareLink() {
    if (!applyUrl) return;
    const how = await shareOrCopy({ title: `Join ${neighborhood.name} on Circles`, text: `Apply to join ${neighborhood.name}'s circle on Circles.`, url: applyUrl });
    if (how === "copied") showToast({ tone: "success", title: "Link copied", message: `It opens the application with ${neighborhood.name} already chosen.` });
    if (how === "failed") showToast({ tone: "error", message: "Couldn't copy the link. Your browser blocked it." });
  }

  useTopBarMenu([
    { label: "Print", icon: PrinterIcon, onSelect: printPage },
    { label: "Share link", icon: ArrowUpTrayIcon, onSelect: () => void shareLink() },
  ]);

  const poster = <NeighborhoodPoster neighborhood={neighborhood} city={city} applyUrl={applyUrl} />;
  return (
    <PageContainer size="normal">
      <p className="mb-5 font-serif text-sm leading-normal text-soft">
        Print it for your building&rsquo;s mailroom or a noticeboard, or share the link it leads to. It shows how many neighbors are on Circles, never who.
      </p>
      {/* the sheet, framed as it'll print */}
      <div className="border border-faint p-6 min-[720px]:p-10">{poster}</div>
      <PrintSheet>{poster}</PrintSheet>
    </PageContainer>
  );
}
