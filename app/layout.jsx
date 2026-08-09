import "./globals.css";
import { ToastProvider } from "@/components/chrome/toast";

export const metadata = {
  title: "Convene",
  description: "A federated coordination tool for neighborhoods and organizations.",
};

// AppStateProvider/ProfileModalProvider/AppShell live in app/(app)/layout.jsx
// now, not here — this root layout covers both the unauthenticated welcome
// page and the (app) group, and the welcome page needs neither the app chrome
// nor a fetch that depends on being logged in. ToastProvider stays here since
// it's harmless pre-login and means the welcome page's login form gets
// useToast() for free.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
