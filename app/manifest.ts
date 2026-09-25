import type { MetadataRoute } from "next";

/* What makes Circles installable as an app. Served at /manifest.webmanifest,
   which proxy.ts lets through without a session: browsers fetch the manifest
   and its icons without cookies. Icons come from scripts/generate-icons.tsx. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Circles",
    short_name: "Circles",
    description: "A federated coordination tool for neighborhoods and organizations.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    // honoured by Android's installed apps; iOS ignores it and still rotates
    orientation: "portrait",
    // paper, like the top bar, so the splash screen and status bar run into it seamlessly
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
