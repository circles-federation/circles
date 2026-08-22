import clsx from "clsx";
import { Eyebrow } from "@/components/shared/eyebrow";
import { avatarFor, memberById } from "@/lib/data";
import { isPastEvent } from "@/lib/format.util";
import { roleFull, roleUnmet } from "@/lib/roles.util";

/* One named role (e.g. shift lead): fill status, description, a take/leave
   toggle, and the roster of whoever's currently in it. Private to
   RoleSlotsSection — not used anywhere else. */
function RoleSlotCard({ role, event: e, profile, onToggleRoleSlot, onOpenMember }) {
  const past = isPastEvent(e);
  const filled = role.members.map(memberById).filter(Boolean);
  const mine = role.members.includes(profile.id);
  const unmet = roleUnmet(role);
  const full = roleFull(role) && !mine;
  const disabled = past || full;

  return (
    <div className={clsx("border px-4.5 py-4", unmet ? "border-ink" : "border-faint")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-sans text-lg font-extrabold">{role.label}</span>
            {role.min > 0 ? (
              <span className={clsx("border px-2 py-0.5 font-sans text-label font-bold uppercase tracking-[0.08em]", unmet ? "border-ink bg-ink text-paper" : "border-leaf text-leaf")}>
                {unmet ? "Needed" : "Filled"}
              </span>
            ) : (
              <span className="border border-faint px-2 py-0.5 font-sans text-label font-bold uppercase tracking-[0.08em] text-soft">
                Optional
              </span>
            )}
            {roleFull(role) && (
              <span className="border border-faint px-2 py-0.5 font-sans text-label font-bold uppercase tracking-[0.08em] text-soft">
                Full
              </span>
            )}
          </div>
          {role.description && (
            <p className="mt-1.5 max-w-[40em] font-serif text-sm leading-[1.45] text-[#333]">{role.description}</p>
          )}
          <Eyebrow className="mt-1.5 text-soft">
            {filled.length}{role.max != null ? `/${role.max}` : ""} {filled.length === 1 && role.max == null ? "person" : "people"}{role.min > 0 ? ` · needs ${role.min}` : (role.max == null ? " · any number" : "")}
          </Eyebrow>
        </div>
        <button
          onClick={() => { if (!past && !full) onToggleRoleSlot(e.id, role.key); }}
          disabled={disabled}
          title={full ? "This slot is full" : undefined}
          className={clsx(
            "whitespace-nowrap border px-4 py-2.75 font-sans text-xs font-bold uppercase tracking-[0.08em]",
            disabled ? "cursor-not-allowed border-faint bg-paper text-soft" : clsx("cursor-pointer border-ink", mine ? "bg-ink text-paper" : "bg-paper text-ink"),
          )}
        >
          {past ? (mine ? "✓ You were in" : "Filled") : (mine ? "✓ You're in — leave" : (full ? "Full" : `Take ${role.label.toLowerCase()}`))}
        </button>
      </div>
      {filled.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {filled.map((m) => (
            <button
              key={m.id}
              onClick={() => onOpenMember(m)}
              className={clsx("flex cursor-pointer items-center gap-2 border border-ink py-1.5 pr-2.5 pl-1.5", m.id === profile.id ? "bg-[#f4f4f4]" : "bg-paper")}
            >
              <img src={avatarFor(m)} alt="" className="h-7 w-7 border border-ink object-cover" />
              <span className="font-sans text-xs font-bold">{m.name}{m.id === profile.id ? " (you)" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Role-slotted events (e.g. shift-style "Open Hours") replace a plain RSVP
   with named roles people sign up for individually. Renders nothing for
   events without roles. */
export function RoleSlotsSection({ event: e, profile, onToggleRoleSlot, onOpenMember }) {
  if (!Array.isArray(e.roles) || e.roles.length === 0) return null;

  return (
    <section className="pt-8">
      <Eyebrow className="text-soft">Slots</Eyebrow>
      <div className="mt-4 flex flex-col gap-4.5">
        {e.roles.map((role) => (
          <RoleSlotCard
            key={role.key}
            role={role}
            event={e}
            profile={profile}
            onToggleRoleSlot={onToggleRoleSlot}
            onOpenMember={onOpenMember}
          />
        ))}
      </div>
    </section>
  );
}
