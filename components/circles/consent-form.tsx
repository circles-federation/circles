"use client";

import { useEffect, useState } from "react";
import type { ConsentField } from "@/lib/proposals.util";
import type { Circle, CircleProposal } from "@/lib/types";
import { ProposalBanner } from "./proposal-banner";

const TOP_ID = "consent-form-top";

/* A problem with what a Manage circle page proposes: shown under its field
   (or, from the server, which doesn't say which, at the top of the page),
   scrolled to and focused, and cleared as soon as that field's edited.
   Fields wrap themselves in an element with the id `field-<name>`. */
export function useConsentError() {
  const [consentError, setConsentError] = useState<{ field: ConsentField | null; message: string } | null>(null);
  useEffect(() => {
    if (!consentError) return;
    const el = document.getElementById(consentError.field ? `field-${consentError.field}` : TOP_ID);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus({ preventScroll: true });
  }, [consentError]);
  const clearError = (field: ConsentField) => setConsentError((e) => (e && (e.field === field || e.field === null) ? null : e));
  const fieldError = (field: ConsentField) =>
    consentError?.field === field && <p className="mt-2 font-sans text-sm font-bold text-danger">{consentError.message}</p>;
  return { consentError, setConsentError, clearError, fieldError };
}

/* The top of a page whose changes need the circle's consent (Details,
   Roles): that saving proposes them, or the proposal already open, which
   holds them until it's decided; and an error from the server. */
export function ConsentNotice({ circle, openProposal, memberId, error }: { circle: Circle; openProposal?: CircleProposal; memberId: number; error?: string | null }) {
  return (
    <div id={TOP_ID} className="mb-5.5">
      {openProposal ? (
        <>
          <ProposalBanner proposal={openProposal} memberId={memberId} />
          <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">These can be changed again once it&rsquo;s decided.</p>
        </>
      ) : (
        <p className="max-w-[42em] font-serif text-sm leading-relaxed text-soft">
          Changes here need {circle.name}&rsquo;s consent: saving proposes them to its members.
        </p>
      )}
      {error && <p className="mt-3 font-sans text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
