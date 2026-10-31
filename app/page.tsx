import { redirect } from "next/navigation";
import { WelcomePage } from "@/components/welcome/welcome.page";
import { getMembers } from "@/lib/db/members";
import { getCurrentUserId } from "@/lib/session";

// reads the roster per request rather than freezing it into the build
export const dynamic = "force-dynamic";

export default async function Page() {
  // a link or home-screen shortcut to the bare address shouldn't ask someone
  // who's signed in to sign in again. The session is checked for real here
  // (proxy.ts only sees that a cookie exists), so a stale cookie can't loop.
  if (await getCurrentUserId()) redirect("/home");
  // the "Demo accounts" list is dev/demo scaffolding — it lists real members'
  // emails to an unauthenticated visitor, so it's dropped entirely from a
  // production build rather than left to ship real people's addresses.
  const demoMembers = process.env.NODE_ENV === "production" ? [] : (await getMembers()).filter((m) => m.email);
  return <WelcomePage demoMembers={demoMembers} />;
}
