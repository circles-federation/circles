import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PressFeedback, ToastProvider } from "@/components/shared";

export const metadata: Metadata = {
  title: "Circles",
  description: "A federated coordination tool for neighborhoods and organizations.",
  // iOS still reads these rather than the manifest when added to the Home
  // Screen. "default" keeps a white status bar above the page, like the top bar.
  appleWebApp: { capable: true, title: "Circles", statusBarStyle: "default" },
};

// viewportFit "cover" draws under the home indicator and a landscape notch, so
// the app's edges pad themselves with env(safe-area-inset-*) — see AppShell,
// TopBar, BottomNav and FloatingActionButton
export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

// AppStateProvider/ProfileModalProvider/AppShell live in app/(app)/layout.jsx
// now, not here — this root layout covers both the unauthenticated welcome
// page and the (app) group, and the welcome page needs neither the app chrome
// nor a fetch that depends on being logged in. ToastProvider stays here since
// it's harmless pre-login and means the welcome page's login form gets
// useToast() for free.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <PressFeedback />
      </body>
    </html>
  );
}
