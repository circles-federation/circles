import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

// the "Cancelled" marker in an event row's status column — an event its
// organizer called off, or a slotted shift that couldn't be filled in time.
// Just the icon, the size of ParticipationBadge's check, which it sits beside;
// the word is for screen readers.
export function CancelledBadge() {
  return (
    <ExclamationTriangleIcon role="img" aria-label="Cancelled" className="size-5 shrink-0 text-flame min-[720px]:size-4" strokeWidth={2} />
  );
}
