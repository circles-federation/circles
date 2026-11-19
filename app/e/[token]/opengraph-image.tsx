import { ImageResponse } from "next/og";
import { getSharedEvent } from "@/lib/db/event-shares";
import { meetingLink } from "@/lib/events.util";
import { fmtEventWhen } from "@/lib/format.util";

export const alt = "An event on Circles";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The picture in a link preview of a shared event: the page's own masthead,
   ink on the page's cream with its colour wash, so the invitation reads at a
   glance in a text thread. Built from SharedEvent like the page, so it says
   nothing a stranger holding the link couldn't already read. A dead link gets
   the plain wordmark, not a hint of whether the event exists. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getSharedEvent(token);
  const INK = "#0a0a0a";
  const SOFT = "#444444";
  // the page's wash (MastheadGlow): the three glow colours, fading out
  const WASH = [
    "radial-gradient(circle at 4% 8%, rgba(111, 224, 210, 0.95) 0%, rgba(111, 224, 210, 0) 42%)",
    "radial-gradient(circle at 52% 0%, rgba(255, 217, 102, 0.95) 0%, rgba(255, 217, 102, 0) 38%)",
    "radial-gradient(circle at 98% 22%, rgba(255, 155, 134, 0.95) 0%, rgba(255, 155, 134, 0) 42%)",
  ].join(", ");

  const title = event ? (event.cancelled ? `Cancelled: ${event.title}` : event.title) : "Circles";
  // a long name gets a smaller size so three lines still fit above the date
  // (lineClamp needs a block, not a flex box, to cut with an ellipsis)
  const titleSize = title.length > 30 ? 68 : 88;

  return new ImageResponse(
    (
      // Messages rounds the card's corners and trims a few pixels from its
      // edges, so nothing is drawn near them: no rule or border, and a wide margin
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#f8f4f0", backgroundImage: WASH, color: INK, padding: "72px 80px" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Circles</div>
        {event ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 32, color: SOFT }}>{event.sharedBy} invited you to</div>
            <div style={{ display: "block", marginTop: 12, fontSize: titleSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: -3, lineClamp: 3 }}>{title}</div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 38, fontWeight: 700 }}>{fmtEventWhen(event)}</div>
            <div style={{ display: "block", marginTop: 8, fontSize: 34, color: SOFT, lineClamp: 1 }}>{meetingLink(event.location) ? "Online" : event.location}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: 44, color: SOFT }}>Neighborhood coordination</div>
        )}
      </div>
    ),
    size
  );
}
