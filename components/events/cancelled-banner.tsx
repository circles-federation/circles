import { XCircleIcon } from "@heroicons/react/24/outline";
import { useMemberById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

/* Heads an event its organizer cancelled (see cancelEvent in lib/db/events.ts)
   — solid, like ShiftStatusBanner's own cancelled state, since it changes
   what the whole page means. Renders nothing for an event that isn't. */
export function CancelledBanner({ event: e }: { event: Event }) {
  const memberById = useMemberById();
  if (!e.cancelled) return null;
  const organizer = memberById(e.organizerId);
  const noun = e.kind === "meeting" ? "meeting" : "event";
  return (
    <div role="status" className="mt-6 flex items-start gap-3 border-2 border-ink bg-ink px-4.5 py-4 text-paper">
      <XCircleIcon className="mt-px size-5 shrink-0" strokeWidth={2} />
      <div>
        <div className="font-sans text-sm font-extrabold tracking-[0.02em]">This {noun} has been cancelled</div>
        <p className="mt-1.5 font-serif text-sm leading-relaxed text-paper">
          {organizer ? `${organizer.name} cancelled it` : "It was cancelled"}, so it won&apos;t be going ahead.
        </p>
      </div>
    </div>
  );
}
