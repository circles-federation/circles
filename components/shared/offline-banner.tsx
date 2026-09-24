"use client";

import clsx from "clsx";
import { SignalSlashIcon } from "@heroicons/react/24/outline";
import { useOnline } from "@/lib/hooks";

/* A thin bar saying the device is offline, shown only while it is: with no
   service worker, a tap then just waits on a request that can't go anywhere,
   and this is what explains it. Sits under TopBar in the app (inside its
   sticky block, so it stays in view) and across the top of the welcome
   page; className places it. */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className={clsx("flex items-center justify-center gap-2 bg-ink px-6 py-2 font-sans text-xs font-semibold text-paper", className)}>
      <SignalSlashIcon className="size-4 shrink-0" strokeWidth={2} />
      You&apos;re offline. Changes won&apos;t save.
    </div>
  );
}
