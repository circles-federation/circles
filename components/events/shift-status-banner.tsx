import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { autoCancelAt, hasRoles, shiftAtRisk, shiftNeedsSlots, unmetRoleLabels } from "@/lib/roles.util";
import { fmtTime, withArticle } from "@/lib/format.util";
import { useClock } from "@/lib/hooks";
import type { Event } from "@/lib/types";

// "a Leader", "a Leader and an Attendee"
function needed(e: Event): string {
  const labels = unmetRoleLabels(e).map(withArticle);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : (labels[0] ?? "someone");
}

// "9:45am", from the moment it'll be cancelled
const clock = (d: Date) => fmtTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);

/* Warns about a slotted event whose required slot is still short (see
   roles.util.ts's lifecycle): a yellow-ruled note while there's more than an
   hour to go, then, within the hour, a solid yellow warning of when it'll be
   cancelled. Yellow for a heads-up, not the orange of a decision waiting on
   members.
   Once it's been cancelled, CancelledBanner says so instead; this renders
   nothing then, nor for a slot that's filled or an event without slots. */
export function ShiftStatusBanner({ event: e }: { event: Event }) {
  // re-renders as the clock moves on, so it turns from a note to a warning
  // (and the warning goes) without a reload; null until hydrated
  const now = useClock();
  if (!hasRoles(e) || now === null) return null;

  if (shiftNeedsSlots(e)) {
    return (
      <div className="mt-6 flex items-start gap-3 border border-ink border-l-4 border-l-warning bg-warning/10 px-4.5 py-4">
        <ExclamationTriangleIcon className="mt-px size-5 shrink-0" strokeWidth={2} aria-hidden />
        <div>
          <div className="font-sans text-sm font-extrabold tracking-[0.02em]">Still needs {needed(e)}</div>
          <p className="mt-1.5 font-serif text-sm leading-relaxed text-[#222]">
            {e.noAutoCancel
              ? "Sign up below so it can run."
              : "It\u2019s cancelled automatically if no one signs up by 15 minutes before it starts. Sign up below to keep it on."}
          </p>
        </div>
      </div>
    );
  }

  if (shiftAtRisk(e)) {
    const cancelAt = autoCancelAt(e);
    return (
      <div role="status" className="mt-6 flex items-start gap-3 border-2 border-warning bg-warning px-4.5 py-4 text-ink">
        <ExclamationTriangleIcon className="mt-px size-5 shrink-0" strokeWidth={2} aria-hidden />
        <div>
          <div className="font-sans text-sm font-extrabold tracking-[0.02em]">
            {cancelAt && cancelAt.getTime() > now ? `Cancels at ${clock(cancelAt)} without ${needed(e)}` : `Still needs ${needed(e)}`}
          </div>
          <p className="mt-1.5 font-serif text-sm leading-relaxed text-ink">
            {cancelAt
              ? "Its host has been told. If no one signs up before then, it\u2019s cancelled and everyone going is told. Sign up below to keep it on."
              : "Its host has been told. Sign up below so it can run."}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
