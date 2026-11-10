"use client";

import { useEffect } from "react";
import "./globals.css";
import { reportClientError } from "@/lib/monitoring-client";

/* What's shown when the whole app fails to render, which replaces the root
   layout, so it brings its own html and body. The error goes to monitoring. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
        <h1 className="font-sans text-2xl font-extrabold tracking-display text-ink">Something went wrong</h1>
        <p className="mt-3 max-w-sm font-serif text-lg leading-normal text-body">The problem has been reported. Trying again often fixes it.</p>
        <button type="button" onClick={reset} className="mt-6 cursor-pointer border-2 border-ink bg-ink px-6 py-4 font-sans text-sm font-extrabold tracking-caps text-paper uppercase">
          Try again
        </button>
      </body>
    </html>
  );
}
