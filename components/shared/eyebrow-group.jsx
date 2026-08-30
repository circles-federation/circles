import { Eyebrow } from "./eyebrow";

/* Pairs an Eyebrow label with the content beneath it, enforcing the
   consistent mt-3.5 gap between them (established across Home, the
   Directory pages, and detail-page sections) instead of each call site
   re-picking its own margin. Renders as one wrapping div — not a fragment —
   specifically so a flex/grid `gap` on the caller's container (e.g.
   profile-modal.jsx's `flex flex-col gap-5.5`) sees each group as a single
   item and only spaces *between* groups; a fragment's children get gapped
   individually too, which doubled the label-to-content spacing on top of
   this component's own mt-3.5. Not a fit for a header that also carries a
   count or a scope chip alongside the label (see AttendeesSection,
   org.page.jsx's facts grid) — those stay bespoke. */
export function EyebrowGroup({ label, children }) {
  return (
    <div>
      <Eyebrow className="text-soft">{label}</Eyebrow>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}
