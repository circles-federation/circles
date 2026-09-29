import type { ReactNode } from "react";

// the few text styles the beta terms and privacy notes are written in
export function LegalHeading({ children }: { children: ReactNode }) {
  return <h2 className="mt-7 mb-2 font-sans text-base font-bold tracking-[-0.01em] text-ink">{children}</h2>;
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="mt-2 font-serif text-base leading-normal text-[#222]">{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 font-serif text-base leading-normal text-[#222]">{children}</ul>;
}
