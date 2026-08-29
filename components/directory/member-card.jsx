import { Chip, Eyebrow } from "@/components/shared";
import { avatarFor } from "@/lib/data";

/* A "file" in the directory hierarchy — a person, who (unlike an org) never
   nests. Reusable card, used anywhere a flat member list is shown.

   showScopeChip defaults on but BrowsePage passes false while browsing
   inside a folder: everyone shown there is definitionally a member of that
   folder's own org, so repeating their neighborhood on every card is
   redundant (same reasoning as OrgCard's showScopeChip) — it only earns its
   place when results can span neighborhoods, e.g. a subtree search from the
   true Directory root. */
export function MemberCard({ m, profile, onOpenMember, showScopeChip = true }) {
  return (
    <button
      onClick={() => onOpenMember(m)}
      className="ink-press bg-paper flex cursor-pointer items-center gap-3.5 border-r border-b border-ink p-4.5 text-left"
    >
      <img src={avatarFor(m)} alt="" className="h-14 w-14 shrink-0 border border-ink object-cover" />
      <div className="min-w-0">
        <div className="font-sans text-base font-extrabold tracking-[-0.01em]">
          {m.name}
          {m.id === profile.id && <span className="font-semibold text-soft"> (you)</span>}
        </div>
        <Eyebrow className="text-soft">{m.role}</Eyebrow>
        {showScopeChip && (
          <div className="mt-1.75">
            <Chip title={`Neighborhood: ${m.neighborhood}`}>{m.neighborhood}</Chip>
          </div>
        )}
      </div>
    </button>
  );
}
