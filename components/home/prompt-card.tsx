import type { ComponentType, ReactNode, SVGProps } from "react";

/* One of Home's one-time prompts, as PromptDeck shows it: an icon, a
   heading, a line or two on why, and its buttons, with where it is in the
   deck in the corner when there's more than one. */
export function PromptCard({ icon: Icon, title, children, actions, corner }: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; children: ReactNode; actions: ReactNode; corner?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border border-ink bg-paper p-5">
      <Icon className="mt-0.5 size-6 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 font-sans text-base font-extrabold">{title}</h2>
          {corner && <span className="shrink-0 font-sans text-label font-bold uppercase tracking-wide text-soft">{corner}</span>}
        </div>
        <p className="mt-1.5 font-serif text-sm leading-normal text-soft">{children}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">{actions}</div>
      </div>
    </div>
  );
}
