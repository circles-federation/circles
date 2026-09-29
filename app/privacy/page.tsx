import type { Metadata } from "next";
import { BetaPrivacy } from "@/components/legal/beta-privacy";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "Privacy · Circles" };

// public, like the welcome page (proxy.ts lets it through)
export default function Page() {
  return (
    <LegalShell title="Privacy">
      <BetaPrivacy />
    </LegalShell>
  );
}
