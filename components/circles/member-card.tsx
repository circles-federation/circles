import { Avatar, Chip, Eyebrow } from "@/components/shared";
import { useCirclesById } from "@/lib/hooks";
import type { Member, Profile } from "@/lib/types";

interface MemberCardProps {
  m: Member;
  profile: Profile;
  onOpenMember: (m: Member) => void;
  showNeighborhoodChip?: boolean;
}

/* A "file" in the circle hierarchy — a person, who (unlike a circle) never
   nests. Reusable card, used anywhere a flat member list is shown.

   showNeighborhoodChip defaults on but NeighborhoodPage passes false while
   browsing inside a folder: everyone shown there is definitionally a member
   of that folder's own circle, so repeating their neighborhood on every card is
   redundant (same reasoning as CircleCard's showNeighborhoodChip) — it only earns its
   place when results can span neighborhoods, e.g. a subtree search from the
   true Circles root. */
export function MemberCard({ m, profile, onOpenMember, showNeighborhoodChip = true }: MemberCardProps) {
  const byId = useCirclesById();
  const home = m.homeCircleId ? byId[m.homeCircleId] : undefined;
  return (
    <button
      onClick={() => onOpenMember(m)}
      className="ink-press bg-paper flex cursor-pointer items-center gap-3.5 border-r border-b border-ink p-4.5 text-left"
    >
      <Avatar member={m} size={56} />
      <div className="min-w-0">
        <div className="font-sans text-base font-extrabold tracking-[-0.01em]">
          {m.name}
          {m.id === profile.id && <span className="font-semibold text-soft"> (you)</span>}
        </div>
        <Eyebrow className="text-soft">{m.role}</Eyebrow>
        {showNeighborhoodChip && home && (
          <div className="mt-1.75">
            <Chip title={`Neighborhood: ${home.name}`}>{home.name}</Chip>
          </div>
        )}
      </div>
    </button>
  );
}
