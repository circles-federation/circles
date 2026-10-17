/* A link that opens an address in the visitor's own maps app. A web page
   can't ask which one they prefer, so it goes by device and browser: Apple
   Maps on an iPhone or iPad (it opens the Maps app) and in Safari on a Mac, a
   geo: link on Android (which opens the default maps app, or asks which), and
   Google Maps on the web for everything else, a Mac in Chrome or Firefox
   included, whose user has chosen something other than Apple's. */

export type MapsPlatform = "apple" | "android" | "web";

export function mapsPlatform(userAgent: string, platform = "", maxTouchPoints = 0): MapsPlatform {
  if (/Android/i.test(userAgent)) return "android";
  // iPadOS reports itself as a Mac, so a Mac with a touchscreen is an iPad
  if (/iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) return "apple";
  // every Mac browser says Safari; only Safari itself doesn't name another
  const safari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(userAgent);
  if (/Macintosh/.test(userAgent) && safari) return "apple";
  return "web";
}

export function mapsUrl(address: string, platform: MapsPlatform): string {
  const q = encodeURIComponent(address.trim());
  if (platform === "apple") return `https://maps.apple.com/?q=${q}`;
  if (platform === "android") return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
