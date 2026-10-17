/* A link that opens an address in the visitor's own maps app. A web page
   can't ask which one they prefer, so it goes by platform: Apple Maps on an
   Apple device (it opens the Maps app), a geo: link on Android (which opens
   the default maps app, or asks which), and Google Maps on the web for
   everything else. */

export type MapsPlatform = "apple" | "android" | "web";

export function mapsPlatform(userAgent: string, platform = "", maxTouchPoints = 0): MapsPlatform {
  if (/Android/i.test(userAgent)) return "android";
  // iPadOS reports itself as a Mac, so a Mac with a touchscreen is an iPad
  if (/iPhone|iPad|iPod|Macintosh/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) return "apple";
  return "web";
}

export function mapsUrl(address: string, platform: MapsPlatform): string {
  const q = encodeURIComponent(address.trim());
  if (platform === "apple") return `https://maps.apple.com/?q=${q}`;
  if (platform === "android") return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
