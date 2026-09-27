import { notFound } from "next/navigation";
import { ApplicationReviewPage } from "@/components/admin/application-review.page";
import { getPendingApplication, isAdmin } from "@/lib/db/applications";
import { getCurrentUserId } from "@/lib/session";

// like the list, fetched here for a system admin only; one already decided is a 404
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const memberId = await getCurrentUserId();
  if (!memberId || !(await isAdmin(memberId))) notFound();
  const application = await getPendingApplication(memberId, (await params).id);
  if (!application) notFound();
  return <ApplicationReviewPage application={application} />;
}
