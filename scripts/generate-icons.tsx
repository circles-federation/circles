import { mkdirSync, writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";

/* Renders every app icon from one mark: circles nested inside each other,
   paper on ink. Rerun after changing the mark (`npm run icons`) and commit
   the output — the icons are static files so the manifest, and anything
   fetching it without a session, never has to hit a route.

   The mark is drawn in a 100×100 box. `scale` sizes it around the centre:
   a maskable icon keeps it inside the central 80% circle that Android may
   crop to, the others can fill more of the square. `background: false`
   leaves the square transparent, for the notification badge. */
function markSvg(scale: number, stroke: number, background = true): string {
  const rings = [
    { r: 28, cy: 50 },
    { r: 17, cy: 55 },
  ];
  const at = (v: number) => 50 + (v - 50) * scale;
  const circles = rings
    .map(({ r, cy }) => `<circle cx="50" cy="${at(cy)}" r="${r * scale}" fill="none" stroke="#ffffff" stroke-width="${stroke}"/>`)
    .join("");
  const backdrop = background ? `<rect width="100" height="100" fill="#0a0a0a"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${backdrop}${circles}<circle cx="50" cy="${at(61)}" r="${6 * scale}" fill="#ffffff"/></svg>`;
}

async function png(path: string, size: number, scale: number, stroke: number, background = true) {
  const src = `data:image/svg+xml;base64,${Buffer.from(markSvg(scale, stroke, background)).toString("base64")}`;
  // next/og's renderer, not a browser: there's no next/image here to prefer
  // eslint-disable-next-line @next/next/no-img-element
  const image = new ImageResponse(<img src={src} width={size} height={size} alt="" />, { width: size, height: size });
  writeFileSync(path, Buffer.from(await image.arrayBuffer()));
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  await png("public/icons/icon-192.png", 192, 1.25, 4);
  await png("public/icons/icon-512.png", 512, 1.25, 4);
  await png("public/icons/icon-maskable-512.png", 512, 1, 4);
  // iOS rounds the corners itself and ignores transparency, so it gets the full square
  await png("app/apple-icon.png", 180, 1.2, 4);
  // a push notification's badge in Android's status bar, which is drawn from
  // the image's transparency alone: the mark with no square behind it (the
  // app icon would show as a solid white square), with the tab icon's thicker
  // strokes since it's shown at about 24px
  await png("public/icons/badge-96.png", 96, 1.35, 6, false);
  // the browser tab: thicker strokes, or they vanish at 16px
  writeFileSync("app/icon.svg", markSvg(1.35, 6));
  console.log("icons written");
}

main();
