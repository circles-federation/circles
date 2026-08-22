import clsx from "clsx";
import { Eyebrow } from "@/components/shared/eyebrow";
import { avatarFor, memberById } from "@/lib/data";
import { canReadDetails, scopeLabel } from "@/lib/governance.util";
import { hasRoles } from "@/lib/roles.util";

/* Flat attendee roster for a non-slotted event (role-slotted events show
   who's in each role instead, via RoleSlotsSection). Hidden for a viewer
   who isn't a resident of an assembly's neighborhood. */
export function AttendeesSection({ event: e, profile, onOpenMember }) {
  if (hasRoles(e)) return null;
  const canRead = canReadDetails(e, profile);
  const attendees = e.rsvps.map(memberById).filter(Boolean);

  return (
    <section className="pt-8">
      <div className="flex items-baseline justify-between">
        <Eyebrow className="text-soft">Who’s going</Eyebrow>
        {canRead && <span className="font-sans text-xs font-extrabold">{attendees.length}</span>}
      </div>
      {canRead ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-0 border-t border-l border-ink">
          {attendees.map((m) => (
            <button
              key={m.id}
              className={clsx("ink-press flex cursor-pointer items-center gap-3 border-0 border-r border-b border-ink p-3.5 text-left", m.id === profile.id ? "bg-[#f4f4f4]" : "bg-paper")}
              onClick={() => onOpenMember(m)}
            >
              <img src={avatarFor(m)} alt="" className="h-11 w-11 shrink-0 border border-ink object-cover" />
              <div>
                <div className="font-sans text-sm font-bold">{m.name}{m.id === profile.id ? " (you)" : ""}</div>
                {/* text-micro omitted: Eyebrow's inline-style guard already dropped this
                    sub-11px override in the original code — see event-masthead.jsx. */}
                <Eyebrow className="text-soft">{m.role}</Eyebrow>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 font-serif text-sm text-soft">
          Hidden — only residents of {scopeLabel(e)} can see who’s attending.
        </p>
      )}
    </section>
  );
}
