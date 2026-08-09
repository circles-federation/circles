import { cookies } from "next/headers";

// Must match lib/auth.js's SESSION_COOKIE.
const SESSION_COOKIE = "session";

/* Plain async helper, NOT a Server Action — only ever called from Server
   Components (app/(app)/layout.jsx). Kept out of lib/auth.js on purpose:
   that file's exports are all Server Actions ("use server"), and mixing this
   in with them broke importing those actions from the Client Component
   welcome page (Next tried to bundle this file's next/headers import for
   the client too). */
export async function getCurrentUserId() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  return id ? Number(id) : null;
}
