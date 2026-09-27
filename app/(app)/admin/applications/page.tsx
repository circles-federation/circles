import { notFound } from "next/navigation";
import { ApplicationsPage } from "@/components/admin/applications.page";
import { getPendingApplications, isAdmin } from "@/lib/db/applications";
import { getCurrentUserId } from "@/lib/session";

/* A Server Component, unlike the app's other routes: applications aren't in
   AppState (only admins may see them), so the page fetches its own, and
   anyone but a system admin gets a 404. */
export const dynamic = "force-dynamic";

export default async function Page() {
  const memberId = await getCurrentUserId();
  if (!memberId || !(await isAdmin(memberId))) notFound();
  return <ApplicationsPage applications={await getPendingApplications(memberId)} />;
}
