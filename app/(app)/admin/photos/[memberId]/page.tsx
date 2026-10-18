import { notFound } from "next/navigation";
import { PhotoReviewPage } from "@/components/admin/photo-review.page";
import { isAdmin } from "@/lib/db/applications";
import { getPhotoReview } from "@/lib/db/photo-reviews";
import { getCurrentUserId } from "@/lib/session";

// like the list, fetched here for a system admin only; one already decided is a 404
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const adminId = await getCurrentUserId();
  if (!adminId || !(await isAdmin(adminId))) notFound();
  const memberId = Number((await params).memberId);
  if (!Number.isInteger(memberId)) notFound();
  const review = await getPhotoReview(adminId, memberId);
  if (!review) notFound();
  return <PhotoReviewPage review={review} />;
}
