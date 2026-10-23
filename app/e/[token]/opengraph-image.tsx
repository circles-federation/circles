import { ImageResponse } from "next/og";
import { getSharedEvent } from "@/lib/db/event-shares";
import { meetingLink } from "@/lib/events.util";
import { fmtEventWhen } from "@/lib/format.util";

export const alt = "An event on Circles";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The picture in a link preview of a shared event: the page's own masthead,
   ink on white with a heavy rule across the top, so the invitation reads at a
   glance in a text thread. Built from SharedEvent like the page, so it says
   nothing a stranger holding the link couldn't already read. A dead link gets
   the plain wordmark, not a hint of whether the event exists. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getSharedEvent(token);
  const INK = "#0a0a0a";
  const SOFT = "#666666";

  const title = event ? (event.cancelled ? `Cancelled: ${event.title}` : event.title) : "Circles";
  const small = title.length > 40;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#ffffff", color: INK, padding: "56px 72px 64px", borderTop: `14px solid ${INK}` }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Circles</div>
        {event ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 34, color: SOFT }}>{event.sharedBy} invited you to</div>
            <div style={{ display: "flex", marginTop: 16, fontSize: small ? 72 : 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, lineClamp: 3 }}>{title}</div>
            <div style={{ display: "flex", marginTop: 32, fontSize: 40, fontWeight: 700 }}>{fmtEventWhen(event)}</div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 36, color: SOFT, lineClamp: 1 }}>{meetingLink(event.location) ? "Online" : event.location}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: 44, color: SOFT }}>Neighborhood coordination</div>
        )}
      </div>
    ),
    size
  );
}
