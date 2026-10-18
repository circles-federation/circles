import { notFound } from "next/navigation";
import { ReviewPage } from "@/components/admin/review.page";
import { getPendingApplications, isAdmin } from "@/lib/db/applications";
import { getPhotoReviews } from "@/lib/db/photo-reviews";
import { getCurrentUserId } from "@/lib/session";

/* A Server Component, unlike the app's other routes: what's waiting for
   review isn't in AppState (only admins may see it), so the page fetches its
   own, and anyone but a system admin gets a 404. */
export const dynamic = "force-dynamic";

export default async function Page() {
  const memberId = await getCurrentUserId();
  if (!memberId || !(await isAdmin(memberId))) notFound();
  const [applications, photos] = await Promise.all([getPendingApplications(memberId), getPhotoReviews(memberId)]);
  return <ReviewPage applications={applications} photos={photos} />;
}
