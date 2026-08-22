import clsx from "clsx";

/* Wraps a run of Sections and owns the hairline rules between them (via
   Tailwind's divide-y, so a lone or last Section never ends up with a
   dangling border of its own) plus one final rule after the last child,
   matching the rule that used to trail every section unconditionally. */
export function SectionGroup({ className, children, ...rest }) {
  return (
    <div className={clsx("divide-y divide-faint border-b border-faint", className)} {...rest}>
      {children}
    </div>
  );
}
