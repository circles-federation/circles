import { Eyebrow } from "@/components/shared";
import { hostInfo } from "@/lib/data";
import { isExclusive } from "@/lib/governance.util";

/* Explains that this event is members-only. Only ever rendered for a viewer
   who can actually see the event — AppStateProvider's visibleEvents filter
   already hides members-only events from non-members everywhere, so anyone
   reaching this page is a member by definition. Renders nothing for
   non-exclusive events. */
export function ExclusiveNotice({ event: e }) {
  if (!isExclusive(e)) return null;
  const h = hostInfo(e.host);

  return (
    <div className="mt-5 border border-plum border-l-4 bg-plum/5 px-4.5 py-4">
      <Eyebrow className="text-plum">Members-only event</Eyebrow>
      <p className="mt-2 max-w-[44em] font-serif text-sm leading-relaxed text-[#222]">
        Only members of {h.label} can see this event, RSVP, and get notified about it.
      </p>
    </div>
  );
}
