import { getMemberPhoto } from "@/lib/db/members";
import { getCurrentUserId } from "@/lib/session";

/* Serves a member's uploaded photo (see avatarFor in lib/members.util.ts).
   Only to a viewer who may see it — getMemberPhoto applies the same
   shared-circle rule the Avatar component does, so the photo can't be fetched
   by URL around it. The URL carries the photo's version, so a response never
   goes stale and can be cached for good (privately — it's gated per viewer). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewerId = await getCurrentUserId();
  if (!viewerId) return new Response(null, { status: 401 });
  const memberId = Number((await params).id);
  if (!Number.isInteger(memberId)) return new Response(null, { status: 404 });

  const photo = await getMemberPhoto(viewerId, memberId);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
