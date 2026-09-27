import { getApplicationPhoto } from "@/lib/db/applications";
import { getCurrentUserId } from "@/lib/session";

/* An application's photo, for the admin reviewing it — and no one else: the
   applicant isn't a member, so no member rule applies. Never cached, since
   it's cleared once the application is decided. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewerId = await getCurrentUserId();
  if (!viewerId) return new Response(null, { status: 401 });
  const photo = await getApplicationPhoto(viewerId, (await params).id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
