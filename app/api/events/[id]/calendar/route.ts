import { calendarFileName, eventCalendarFile } from "@/lib/calendar.util";
import { getVisibleEvent } from "@/lib/db/events";
import { getCurrentUserId } from "@/lib/session";

// the community's time zone, which event times are in — the same TZ the
// daily digest's hour is read in; Providence's when it isn't set
const COMMUNITY_TZ = process.env.TZ || "America/New_York";

/* An event as a calendar file, for its page's "Add to calendar" — served only
   to a member who may see the event, like the event itself. Sent inline as
   text/calendar, which is what makes a phone offer to add it rather than just
   saving a file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = await getCurrentUserId();
  if (!memberId) return new Response(null, { status: 401 });
  const event = await getVisibleEvent(memberId, (await params).id);
  // nor one its circle is still deciding, which may never be held
  if (!event || event.cancelled || event.proposed) return new Response(null, { status: 404 });
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return new Response(eventCalendarFile(event, { tz: COMMUNITY_TZ, url: `${base}/events/${event.id}` }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${calendarFileName(event)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
