import { EyebrowGroup } from "@/components/shared";
import type { Event } from "@/lib/types";

/* The event's description. Everyone who can see an event can read all of it —
   an event is only ever visible to the members of its own circle. */
export function EventDetailsSection({ event: e }: { event: Event }) {
  return (
    <section className="border-b border-faint py-8">
      <EyebrowGroup label="Details">
        <p className="max-w-[40em] font-serif text-lg leading-[1.55]">{e.description}</p>
      </EyebrowGroup>
    </section>
  );
}
