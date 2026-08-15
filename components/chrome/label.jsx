import clsx from "clsx";

/* Shared eyebrow-style caption above a field, group, or other content
   (e.g. "About", "Website", "Quick facts"). Carries its own bottom
   margin so whatever it labels never needs a matching top margin of its
   own to compensate. */
export function Label({ children, className, ...rest }) {
  return (
    <label
      className={clsx("mb-2 block font-sans text-eyebrow font-bold uppercase tracking-[0.12em] text-soft", className)}
      {...rest}
    >
      {children}
    </label>
  );
}
