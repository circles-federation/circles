import { getMeetingGuestPhoto } from "@/lib/db/meeting-sessions";
import { getCurrentUserId } from "@/lib/session";

/* The photo of the member a meeting's guest turned out to be (see
   MeetingGuest.photoVersion), only for a member of the meeting's circle. The
   version in the URL keeps it cacheable for good, as the member photo route's. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const viewerId = await getCurrentUserId();
  if (!viewerId) return new Response(null, { status: 401 });
  const { id, guestId } = await params;
  const photo = await getMeetingGuestPhoto(viewerId, id, guestId);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
