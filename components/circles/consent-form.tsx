"use client";

import { useEffect, useState } from "react";
import type { ConsentField } from "@/lib/proposals.util";
import clsx from "clsx";
import type { CircleProposal } from "@/lib/types";
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
   Roles): the proposal already open, which holds them until it's decided,
   and an error from the server. That saving proposes is said by the top
   bar's orange Propose button, not here. */
export function ConsentNotice({ openProposal, memberId, error }: { openProposal?: CircleProposal; memberId: number; error?: string | null }) {
  // an empty anchor still, so a server error has somewhere to scroll to
  if (!openProposal && !error) return <div id={TOP_ID} />;
  return (
    <div id={TOP_ID} className="mb-5.5">
      {openProposal ? (
        <>
          <ProposalBanner proposal={openProposal} memberId={memberId} />
          <p className="mt-2 max-w-[42em] font-serif text-sm leading-relaxed text-soft">These can be changed again once it&rsquo;s decided.</p>
        </>
      ) : null}
      {error && <p className={clsx("font-sans text-sm font-bold text-danger", openProposal && "mt-3")}>{error}</p>}
    </div>
  );
}
