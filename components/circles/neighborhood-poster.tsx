import { ChipView, Eyebrow, QrCode } from "@/components/shared";
import type { Circle } from "@/lib/types";

// the address printed under the code, for a camera that won't scan it
const CIRCLES_SITE = "circles.foundation";

interface NeighborhoodPosterProps {
  neighborhood: Pick<Circle, "name" | "members">;
  // the city it's in, as the masthead's chip
  city: string;
  // where the code leads: the application, the neighborhood already chosen
  applyUrl: string | null;
}

/* "Join your neighborhood circle": a poster for a building's mailroom or a
   noticeboard, laid out like a circle's masthead (its kind opposite its
   city's chip, its name as the headline) over what Circles is, how joining
   works, how many neighbors are on it, and a QR code to the application.
   Nothing about any member but how many there are. The same on screen and
   in print, where it fills a letter-size page (InviteNeighborsPage). */
export function NeighborhoodPoster({ neighborhood, city, applyUrl }: NeighborhoodPosterProps) {
  const count = neighborhood.members.length;
  // in print a sheet of fixed size, 720 by 912 CSS pixels (7.5 by 9.5
  // inches, inside a letter page's margins with some to spare), its type
  // sized in pixels too: iOS lays a printed page out at the phone's width
  // and scales that to the paper, so anything sized by the screen or in
  // inches came out a fraction of the page, and over two
  return (
    <article className="flex flex-col bg-paper text-ink print:h-[912px] print:overflow-hidden">
      <div className="border-t-[3px] border-t-ink pt-5">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow className="shrink-0 text-soft">Neighborhood</Eyebrow>
          <ChipView tone="federation">{city}</ChipView>
        </div>
        <h1 className="mt-3 font-sans text-title leading-[0.92] font-extrabold tracking-display wrap-break-word print:text-[64px]">{neighborhood.name}</h1>
        <p className="mt-4 font-serif text-xl text-body italic print:text-2xl">Join your neighborhood circle.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 border-t border-faint pt-8 min-[720px]:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-6">
          <section>
            <Eyebrow className="text-soft">What it is</Eyebrow>
            <p className="mt-2 font-serif text-lg leading-[1.5] text-body">
              Circles is where {neighborhood.name}&rsquo;s neighbors find each other: news on the neighborhood&rsquo;s bulletin, events coming up nearby, and the councils and groups
              that get things done.
            </p>
          </section>
          <section>
            <Eyebrow className="text-soft">How to join</Eyebrow>
            <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0 font-serif text-lg leading-[1.4] text-body">
              {["Scan the code with your phone’s camera.", "Join with your name, your email and a photo of yourself.", `A person reads every application and checks that you live in ${neighborhood.name}. Then you’re in.`].map(
                (step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-5 shrink-0 font-sans font-extrabold text-ink">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                )
              )}
            </ol>
          </section>
        </div>

        {/* the way in: large enough to scan from arm's length on a wall */}
        <div className="flex flex-col items-center gap-3 justify-self-center">
          {applyUrl ? (
            <QrCode value={applyUrl} label={`QR code to join ${neighborhood.name} on Circles`} className="size-56 text-ink print:size-[288px]" />
          ) : (
            <div className="size-56 bg-wash print:size-[288px]" aria-hidden />
          )}
          <p className="m-0 text-center font-sans text-sm font-bold tracking-caps uppercase">Scan to join</p>
          <p className="m-0 text-center font-serif text-base text-soft">or visit {CIRCLES_SITE}</p>
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4 border-t border-faint pt-5 print:mt-auto">
        <p className="m-0 font-sans text-lg font-extrabold tracking-heading">
          {count === 1 ? "1 neighbor is" : `${count} neighbors are`} already on Circles.
        </p>
        <span className="font-sans text-xl font-extrabold tracking-display">Circles</span>
      </div>
    </article>
  );
}
