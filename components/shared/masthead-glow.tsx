/* The blurred teal, yellow and coral wash behind a masthead, fading into the
   page, with a grain over it. Decorative: put it first inside a parent that is
   `relative isolate`; it fills that parent (and a little above it and into
   the page's gutters). `tall` is for a parent that is the whole page (Home). The grain is a pre-rendered tile
   (public/grain.png), not a live SVG filter, which is slow to paint on a phone.
   Only for pages that introduce something (a circle, a profile, an event,
   Home, Welcome), never a working screen like Tasks. */
export function MastheadGlow({ tall = false }: { tall?: boolean }) {
  return <div aria-hidden className={tall ? "masthead-glow masthead-glow-tall" : "masthead-glow"} />;
}
