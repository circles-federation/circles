import { hasRoles, roleUnmet, shiftCancelled, shiftNeedsSlots } from "@/lib/roles.util";
import type { Event } from "@/lib/types";

/* Warns about a role-slotted event's fill status: a neutral heads-up while
   there's still time to fill a required slot, or a solid "cancelled" banner
   once it's inside the cancellation window with a slot still unfilled.
   Renders nothing outside those two states (including for non-slotted
   events). */
export function ShiftStatusBanner({ event: e }: { event: Event }) {
  if (!hasRoles(e)) return null;
  const unmetLabel = () => e.roles.filter(roleUnmet).map((r) => r.label.toLowerCase()).join(" and ");

  if (shiftNeedsSlots(e)) {
    return (
      <div className="mt-6 flex items-start gap-3 border border-ink border-l-4 border-l-flame bg-flame/5 px-4.5 py-4">
        <span className="text-lg leading-[1.1] text-flame">⚠</span>
        <div>
          <div className="font-sans text-sm font-extrabold tracking-[0.02em]">Still needs a {unmetLabel()}</div>
          <p className="mt-1.5 font-serif text-sm leading-relaxed text-[#222]">
            This shift will be cancelled if the required slot isn’t filled by an hour before it starts. Sign up below to keep it on.
          </p>
        </div>
      </div>
    );
  }

  if (shiftCancelled(e)) {
    return (
      <div className="mt-6 flex items-start gap-3 border-2 border-ink bg-ink px-4.5 py-4 text-paper">
        <span className="text-lg leading-[1.1]">⚠</span>
        <div>
          <div className="font-sans text-sm font-extrabold tracking-[0.02em]">Open hours cancelled</div>
          <p className="mt-1.5 font-serif text-sm leading-relaxed text-paper">
            This shift can’t run without a {unmetLabel()}. You can still take the open slot up to the end time and the shift is back on.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
