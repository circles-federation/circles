import { UserIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { MeetingGuest } from "@/lib/types";

/* A meeting's guest: a placeholder, until the email they were written in under
   belongs to a member with a photo, which then stands in for it. It's fetched
   by guest, not member (see getMeetingGuestPhoto), so it works for anyone in
   the meeting's circle, whether or not they share one with that member. */
export function GuestAvatar({ eventId, guest, size = 44, className }: { eventId: string; guest: MeetingGuest; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (guest.photoVersion) {
    // eslint-disable-next-line @next/next/no-img-element -- served only to the meeting's circle, by version
    return <img src={`/api/meetings/${eventId}/guests/${guest.id}/photo?v=${guest.photoVersion}`} alt="" style={style} className={clsx("shrink-0 border border-ink object-cover", className)} />;
  }
  return (
    <div style={style} className={clsx("flex shrink-0 items-center justify-center border border-ink bg-faint", className)}>
      <UserIcon className="h-1/2 w-1/2 text-soft" strokeWidth={1.5} aria-hidden />
    </div>
  );
}
