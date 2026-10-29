import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PressFeedback, ToastProvider } from "@/components/shared";
import { startupImages } from "@/lib/startup-screens";
import { LIGHT_THEME, themeByKey, themeScript } from "@/lib/themes.util";

export const metadata: Metadata = {
  title: "Circles",
  description: "A federated coordination tool for neighborhoods and organizations.",
  // iOS still reads these rather than the manifest when added to the Home
  // Screen. "default" keeps a white status bar above the page, like the top bar.
  appleWebApp: { capable: true, title: "Circles", statusBarStyle: "default", startupImage: startupImages },
};

// viewportFit "cover" draws under the home indicator and a landscape notch, so
// the app's edges pad themselves with env(safe-area-inset-*) — see AppShell,
// TopBar, BottomNav and FloatingActionButton. interactiveWidget makes the
// on-screen keyboard shorten the page rather than slide it up, so the top bar
// stays put as in a native app; Safari doesn't support it yet, which is what
// AppShell's useIosKeyboard stands in for until it does.
export const viewport: Viewport = {
  // the light theme's, until the theme script (below) sets this device's
  themeColor: themeByKey(LIGHT_THEME).browserColor,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const INSTALL_OFFER_CATCHER = `addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__installOffer = e; });`;

// AppStateProvider/AppShell live in app/(app)/layout.jsx
// now, not here — this root layout covers both the unauthenticated welcome
// page and the (app) group, and the welcome page needs neither the app chrome
// nor a fetch that depends on being logged in. ToastProvider stays here since
// it's harmless pre-login and means the welcome page's login form gets
// useToast() for free.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme on <html>
    // before React gets to it, which is meant
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* this device's theme, before anything draws (lib/themes.util.ts) */}
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
        {/* the browser's offer to install the app can come before any of the
            app's own code has loaded, so it's held here for lib/install.ts */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_OFFER_CATCHER }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        {/* Installed on iOS 27, the system blurs whatever's under the status
            bar unless a fixed element with a solid background sits at the very
            top (at least 6px tall and 80% wide), whose colour it takes instead;
            theme-color and the status bar style meta tag no longer count. The
            top bar can't be that element: it isn't fixed in the installed app,
            its background is a translucent gradient, and its backdrop blur
            would pin a fixed child to it rather than the screen. So this strip,
            over just the status bar, does it, for every page. */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden h-[max(env(safe-area-inset-top),6px)] bg-paper standalone:block" />
        <PressFeedback />
      </body>
    </html>
  );
}
