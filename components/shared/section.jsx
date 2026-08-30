import clsx from "clsx";

/* Shared vertical block on a form/detail page — just the consistent
   padding rhythm repeated down manage-org.page.jsx and similar pages.
   The hairline rules between sections come from the wrapping SectionGroup
   (Tailwind's divide-y), not from Section itself, so a Section used alone
   doesn't carry a dangling border. */
export function Section({ className, children, ...rest }) {
  return (
    <section className={clsx("py-8", className)} {...rest}>
      {children}
    </section>
  );
}
