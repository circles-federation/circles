import { EyebrowGroup } from "@/components/shared";
import { canReadDetails, scopeLabel, scopeNoun } from "@/lib/governance.util";
import type { Event, Profile } from "@/lib/types";

interface EventDetailsSectionProps {
  event: Event;
  profile: Profile;
}

/* The event's description — redacted with blacked-out placeholder bars for
   a viewer outside a meeting's own circle, since its agenda stays internal
   to whichever circle (a Neighborhood Council, a sub-org, or another org)
   convenes it. */
export function EventDetailsSection({ event: e, profile }: EventDetailsSectionProps) {
  const canRead = canReadDetails(e, profile);

  return (
    <section className="border-b border-faint py-8">
      <EyebrowGroup label="Details">
        {canRead ? (
          <p className="max-w-[40em] font-serif text-lg leading-[1.55]">{e.description}</p>
        ) : (
          <div className="max-w-[40em]">
            {/* blacked-out bars standing in for the redacted agenda */}
            <div aria-hidden="true" className="mb-4.5 flex flex-col gap-2.25">
              {[100, 92, 96, 70].map((w, i) => (
                <span key={i} className="block h-4 bg-ink" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="flex items-start gap-3 border border-ink px-4.5 py-4">
              <span className="font-serif text-lg leading-[1.1]">🔒</span>
              <p className="m-0 font-serif text-sm leading-relaxed">
                The agenda and notes for this meeting are visible only to {scopeNoun(e)} of {scopeLabel(e)}. You’re seeing that this meeting exists, but its internal business stays within the circle that convenes it.
              </p>
            </div>
          </div>
        )}
      </EyebrowGroup>
    </section>
  );
}
