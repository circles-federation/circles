import type { Metadata } from "next";
import { BetaTerms } from "@/components/legal/beta-terms";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "Beta terms · Circles" };

// public, like the welcome page (proxy.ts lets it through)
export default function Page() {
  return (
    <LegalShell title="Beta terms">
      <BetaTerms />
    </LegalShell>
  );
}
