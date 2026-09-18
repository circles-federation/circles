import { headers } from "next/headers";
import { auth } from "@/lib/better-auth";
import { getMemberByEmail } from "@/lib/db/members";

/* Plain async helper, NOT a Server Action — only ever called from Server
   Components (app/(app)/layout.tsx). Kept out of lib/auth.ts on purpose:
   that file's exports are all Server Actions ("use server"), and mixing this
   in with them broke importing those actions from the Client Component
   welcome page (Next tried to bundle this file's next/headers import for
   the client too).

   Better Auth's session carries its own user id, not this app's Member id —
   deliberately not linked by a foreign key (see lib/db/schema.ts's comment
   on the user table), so the two are joined here, by email, the one field
   both systems agree on. */
export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const member = await getMemberByEmail(session.user.email);
  return member ? member.id : null;
}
