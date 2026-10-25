import type { ReactNode } from "react";

interface LetterProps {
  // the circle it's to, as the postmark
  circleName: string;
  // who it's from, to and when, at its head
  from: ReactNode;
  to: ReactNode;
  date: string;
  children: ReactNode;
}

/* A message to a circle as a sheet of paper, as it's read (message.page)
   and as it's written (write-message.page): another sheet peeking out
   under it, the circle's name as a tilted postmark, who it's from and to and
   when at its head, then what's inside it. */
export function Letter({ circleName, from, to, date, children }: LetterProps) {
  return (
    <div className="relative">
      {/* the sheet under it */}
      <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 border border-faint bg-wash" />
      <article className="relative border border-ink bg-paper px-5 pt-6 pb-7 min-[720px]:px-8">
        <span aria-hidden className="absolute top-4 right-4 max-w-28 rotate-6 border-2 border-dashed border-ink px-2 py-1 text-center font-sans text-label leading-tight font-extrabold tracking-caps uppercase">
          {circleName}
        </span>
        <div className="pr-28 font-sans text-sm leading-relaxed text-soft">
          <div>From {from}</div>
          <div>To {to}</div>
          <div>{date}</div>
        </div>
        {children}
      </article>
    </div>
  );
}
