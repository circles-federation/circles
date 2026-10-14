"use client";

import { useState, useSyncExternalStore } from "react";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow, InstallStepsModal } from "@/components/shared";
import { isIPhoneBrowserTab } from "@/lib/viewport";

const noSubscribe = () => () => {};

/* Offers the installed app to someone on an iPhone before they sign in. iOS
   has no install API (no beforeinstallprompt), so the best a page can do is
   walk them through Add to Home Screen themselves. Before signing in,
   because the installed app keeps its own cookies apart from Safari's, so a
   session started here wouldn't carry over to it. */
export function InstallPrompt() {
  // false on the server and during hydration, so the markup matches
  const show = useSyncExternalStore(noSubscribe, isIPhoneBrowserTab, () => false);
  const [open, setOpen] = useState(false);

  if (!show) return null;

  return (
    <>
      <div className="mt-10 border-t border-ink pt-4.5">
        <Eyebrow className="text-soft">On your iPhone?</Eyebrow>
        <p className="mt-2 mb-4 font-serif text-base leading-normal text-[#222]">
          Install Circles on your home screen to open it like any other app.
        </p>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <PlusCircleIcon className="size-5" strokeWidth={2} />
          Install the app
        </Button>
      </div>

      {open && <InstallStepsModal onClose={() => setOpen(false)} />}
    </>
  );
}
