import { Eyebrow } from "@/components/chrome/eyebrow";
import { canReadDetails, scopeLabel } from "@/lib/governance.util";

/* The event's description — redacted with blacked-out placeholder bars for
   a viewer who isn't a resident of an assembly's neighborhood, since a
   neighborhood assembly's agenda stays internal to that neighborhood. */
export function EventDetailsSection({ event: e, profile }) {
  const canRead = canReadDetails(e, profile);

  return (
    <section className="border-b border-faint py-8">
      <Eyebrow className="text-soft">Details</Eyebrow>
      {canRead ? (
        <p className="mt-3.5 max-w-[40em] font-serif text-lg leading-[1.55]">{e.description}</p>
      ) : (
        <div className="mt-4 max-w-[40em]">
          {/* blacked-out bars standing in for the redacted agenda */}
          <div aria-hidden="true" className="mb-4.5 flex flex-col gap-2.25">
            {[100, 92, 96, 70].map((w, i) => (
              <span key={i} className="block h-4 bg-ink" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="flex items-start gap-3 border border-ink px-4.5 py-4">
            <span className="font-serif text-lg leading-[1.1]">🔒</span>
            <p className="m-0 font-serif text-sm leading-relaxed">
              The agenda and notes for a neighborhood assembly are visible only to residents of {scopeLabel(e)}. You’re seeing that this meeting exists, but its internal business stays within the neighborhood that convenes it.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
