import "./globals.css";
import { AppShell } from "@/components/chrome/app-shell";
import { ToastProvider } from "@/components/chrome/toast";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { ProfileModalProvider } from "@/components/providers/profile-modal-provider";

export const metadata = {
  title: "Convene",
  description: "A federated coordination tool for neighborhoods and organizations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AppStateProvider>
            <ProfileModalProvider>
              <AppShell>{children}</AppShell>
            </ProfileModalProvider>
          </AppStateProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
