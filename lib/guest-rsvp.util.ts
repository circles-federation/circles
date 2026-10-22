import { EMAIL_SHAPE } from "@/lib/applications.util";

// the cookie that remembers a browser's confirmed guest RSVPs (lib/guest-rsvp.ts):
// their ids, comma-separated. Kept out of the "use server" file, which may only
// export actions.
export const GUEST_COOKIE = "guest_rsvps";

export function guestIdsFrom(value: string | undefined): string[] {
  return (value ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/.test(id));
}

export const GUEST_NAME_MAX = 60;

// shared by the dialog (instant feedback) and the server (the real check)
export function validateGuest(name: string, email: string): string | null {
  if (!name.trim()) return "Enter your name.";
  if (name.trim().length > GUEST_NAME_MAX) return `Keep your name under ${GUEST_NAME_MAX} characters.`;
  if (!EMAIL_SHAPE.test(email.trim())) return "Enter an email address, like you@example.com.";
  return null;
}
